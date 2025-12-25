package com.pharmaapp.mltest

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import ai.onnxruntime.*
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.FloatBuffer
import java.util.Optional

class MLTestModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  
  private var ortEnv: OrtEnvironment? = null
  private var detectionSession: OrtSession? = null
  private var classificationSession: OrtSession? = null
  private var classificationSession150: OrtSession? = null  // 150 sınıflı model
  private var tempModelDir: File? = null
  
  companion object {
    const val DETECTION_INPUT_SIZE = 640
    const val CLASSIFICATION_INPUT_SIZE = 224
    const val DETECTION_MODEL_PATH = "detection.onnx"
    const val CLASSIFICATION_MODEL_PATH = "classification.onnx"
    const val CLASSIFICATION_MODEL_150_PATH = "classification_150.onnx"  // 150 sınıflı model
  }

  override fun getName(): String {
    return "MLTestModule"
  }

  /**
   * Detection modelini yükle
   */
  @ReactMethod
  fun loadDetectionModel(promise: Promise) {
    try {
      if (ortEnv == null) {
        ortEnv = OrtEnvironment.getEnvironment()
      }

      val context = reactApplicationContext
      
      // Geçici dizin oluştur (external data dosyaları için)
      if (tempModelDir == null) {
        tempModelDir = File(context.cacheDir, "onnx_models")
        tempModelDir!!.mkdirs()
      }
      
      // Model dosyasını assets'ten geçici dizine kopyala
      val modelFile = File(tempModelDir, DETECTION_MODEL_PATH)
      val inputStream = context.assets.open(DETECTION_MODEL_PATH)
      val outputStream = FileOutputStream(modelFile)
      inputStream.copyTo(outputStream)
      inputStream.close()
      outputStream.close()
      
      // External data dosyasını da kopyala (varsa)
      try {
        val dataFile = File(tempModelDir, "${DETECTION_MODEL_PATH}.data")
        val dataInputStream = context.assets.open("${DETECTION_MODEL_PATH}.data")
        val dataOutputStream = FileOutputStream(dataFile)
        dataInputStream.copyTo(dataOutputStream)
        dataInputStream.close()
        dataOutputStream.close()
      } catch (e: Exception) {
        // External data dosyası yoksa devam et
      }

      val sessionOptions = OrtSession.SessionOptions()
      sessionOptions.setIntraOpNumThreads(4)
      sessionOptions.setInterOpNumThreads(4)

      // Dosya yolundan session oluştur (external data desteği için)
      detectionSession = ortEnv!!.createSession(modelFile.absolutePath, sessionOptions)
      
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("LOAD_ERROR", "Detection model yükleme hatası: ${e.message}", e)
    }
  }

  /**
   * Classification modelini yükle
   */
  @ReactMethod
  fun loadClassificationModel(promise: Promise) {
    try {
      if (ortEnv == null) {
        ortEnv = OrtEnvironment.getEnvironment()
      }

      val context = reactApplicationContext
      
      // Geçici dizin oluştur (external data dosyaları için)
      if (tempModelDir == null) {
        tempModelDir = File(context.cacheDir, "onnx_models")
        tempModelDir!!.mkdirs()
      }
      
      // Model dosyasını assets'ten geçici dizine kopyala
      val modelFile = File(tempModelDir, CLASSIFICATION_MODEL_PATH)
      val inputStream = context.assets.open(CLASSIFICATION_MODEL_PATH)
      val outputStream = FileOutputStream(modelFile)
      inputStream.copyTo(outputStream)
      inputStream.close()
      outputStream.close()
      
      // External data dosyasını da kopyala (varsa)
      try {
        val dataFile = File(tempModelDir, "${CLASSIFICATION_MODEL_PATH}.data")
        val dataInputStream = context.assets.open("${CLASSIFICATION_MODEL_PATH}.data")
        val dataOutputStream = FileOutputStream(dataFile)
        dataInputStream.copyTo(dataOutputStream)
        dataInputStream.close()
        dataOutputStream.close()
      } catch (e: Exception) {
        // External data dosyası yoksa devam et
      }

      val sessionOptions = OrtSession.SessionOptions()
      sessionOptions.setIntraOpNumThreads(4)
      sessionOptions.setInterOpNumThreads(4)

      // Dosya yolundan session oluştur (external data desteği için)
      classificationSession = ortEnv!!.createSession(modelFile.absolutePath, sessionOptions)
      
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("LOAD_ERROR", "Classification model yükleme hatası: ${e.message}", e)
    }
  }

  /**
   * Detection inference
   */
  @ReactMethod
  fun runDetection(imagePath: String, promise: Promise) {
    try {
      if (detectionSession == null) {
        promise.reject("NOT_LOADED", "Detection model yüklenmemiş")
        return
      }

      val bitmap = loadBitmap(imagePath)
      val resizedBitmap = Bitmap.createScaledBitmap(bitmap, DETECTION_INPUT_SIZE, DETECTION_INPUT_SIZE, true)
      
      // Bitmap'i FloatBuffer'a çevir (NCHW format, normalized)
      val inputBuffer = bitmapToFloatBuffer(resizedBitmap, DETECTION_INPUT_SIZE, DETECTION_INPUT_SIZE)
      
      // Input tensor oluştur [1, 3, 640, 640]
      val inputShape = longArrayOf(1, 3, DETECTION_INPUT_SIZE.toLong(), DETECTION_INPUT_SIZE.toLong())
      val inputTensor = OnnxTensor.createTensor(ortEnv!!, inputBuffer, inputShape)
      
      // Input name'i session'dan al (YOLOv8 genellikle "images" veya "input" kullanır)
      val inputNames = detectionSession!!.inputNames
      val inputName = inputNames.iterator().next()
      
      // Inference çalıştır
      val inputs = mapOf(inputName to inputTensor)
      val outputs = detectionSession!!.run(inputs)
      
      // Output'u parse et (YOLOv8 format: [1, 8400, 16] veya [1, 16, 8400])
      // outputs bir Map<String, OnnxValue>, output name'ini session'dan al
      val outputNames = detectionSession!!.outputNames
      val outputName = outputNames.iterator().next()
      // Java Map'ten değer alırken Optional dönebilir, unwrap et
      val outputOptional = outputs[outputName]
      val outputValue = if (outputOptional is Optional<*>) {
        outputOptional.orElse(null) as? OnnxValue
      } else {
        outputOptional as? OnnxValue
      } ?: throw Exception("Output '$outputName' bulunamadı")
      val outputTensor = outputValue as OnnxTensor
      val outputShape = outputTensor.info.shape
      val outputData = outputTensor.floatBuffer.array()
      
      // Debug: Output shape'i logla
      android.util.Log.d("MLTestModule", "Detection output shape: ${outputShape.contentToString()}")
      android.util.Log.d("MLTestModule", "Detection output data size: ${outputData.size}")
      
      // En yüksek confidence'lı detection'ı bul
      val detection = parseYOLOOutput(outputData, outputShape)
      
      // Cleanup
      inputTensor.close()
      outputTensor.close()
      outputs.close()
      
      if (detection != null) {
        val result = WritableNativeMap()
        result.putBoolean("detected", true)
        val detectionMap = WritableNativeMap()
        detectionMap.putDouble("x", detection.x.toDouble())
        detectionMap.putDouble("y", detection.y.toDouble())
        detectionMap.putDouble("width", detection.width.toDouble())
        detectionMap.putDouble("height", detection.height.toDouble())
        detectionMap.putDouble("confidence", detection.confidence.toDouble())
        result.putMap("detection", detectionMap)
        promise.resolve(result)
      } else {
        val result = WritableNativeMap()
        result.putBoolean("detected", false)
        promise.resolve(result)
      }
    } catch (e: Exception) {
      promise.reject("INFERENCE_ERROR", "Detection inference hatası: ${e.message}", e)
    }
  }

  /**
   * Classification inference
   */
  @ReactMethod
  fun runClassification(imagePath: String, promise: Promise) {
    try {
      if (classificationSession == null) {
        promise.reject("NOT_LOADED", "Classification model yüklenmemiş")
        return
      }

      val bitmap = loadBitmap(imagePath)
      val resizedBitmap = Bitmap.createScaledBitmap(bitmap, CLASSIFICATION_INPUT_SIZE, CLASSIFICATION_INPUT_SIZE, true)
      
      // Bitmap'i FloatBuffer'a çevir (NCHW format, normalized for ImageNet)
      val inputBuffer = bitmapToFloatBufferClassification(resizedBitmap, CLASSIFICATION_INPUT_SIZE, CLASSIFICATION_INPUT_SIZE)
      
      // Input tensor oluştur [1, 3, 224, 224]
      val inputShape = longArrayOf(1, 3, CLASSIFICATION_INPUT_SIZE.toLong(), CLASSIFICATION_INPUT_SIZE.toLong())
      val inputTensor = OnnxTensor.createTensor(ortEnv!!, inputBuffer, inputShape)
      
      // Inference çalıştır
      val inputs = mapOf("pixel_values" to inputTensor)
      val outputs = classificationSession!!.run(inputs)
      
      // Output'u parse et (ViT format: [1, 12])
      // outputs bir Map<String, OnnxValue>, output name'ini session'dan al
      val outputNames = classificationSession!!.outputNames
      val outputName = outputNames.iterator().next()
      // Java Map'ten değer alırken Optional dönebilir, unwrap et
      val outputOptional = outputs[outputName]
      val outputValue = if (outputOptional is Optional<*>) {
        outputOptional.orElse(null) as? OnnxValue
      } else {
        outputOptional as? OnnxValue
      } ?: throw Exception("Output '$outputName' bulunamadı")
      val outputTensor = outputValue as OnnxTensor
      val outputData = outputTensor.floatBuffer.array()
      
      // Softmax uygula ve en yüksek sınıfı bul
      val classification = parseClassificationOutput(outputData)
      
      // Cleanup
      inputTensor.close()
      outputTensor.close()
      outputs.close()
      
      val result = WritableNativeMap()
      result.putInt("classIndex", classification.classIndex)
      result.putDouble("confidence", classification.confidence.toDouble())
      
      val allPredictions = WritableNativeArray()
      classification.allPredictions.forEach { pred ->
        val predMap = WritableNativeMap()
        predMap.putInt("index", pred.index)
        predMap.putDouble("confidence", pred.confidence.toDouble())
        allPredictions.pushMap(predMap)
      }
      result.putArray("allPredictions", allPredictions)
      
      promise.resolve(result)
    } catch (e: Exception) {
      promise.reject("INFERENCE_ERROR", "Classification inference hatası: ${e.message}", e)
    }
  }

  /**
   * 150 sınıflı classification modelini yükle
   */
  @ReactMethod
  fun loadClassificationModel150(promise: Promise) {
    try {
      if (ortEnv == null) {
        ortEnv = OrtEnvironment.getEnvironment()
      }

      val context = reactApplicationContext
      
      // Geçici dizin oluştur (external data dosyaları için)
      if (tempModelDir == null) {
        tempModelDir = File(context.cacheDir, "onnx_models")
        tempModelDir!!.mkdirs()
      }
      
      // Model dosyasını assets'ten geçici dizine kopyala
      val modelFile = File(tempModelDir, CLASSIFICATION_MODEL_150_PATH)
      val inputStream = context.assets.open(CLASSIFICATION_MODEL_150_PATH)
      val outputStream = FileOutputStream(modelFile)
      inputStream.copyTo(outputStream)
      inputStream.close()
      outputStream.close()
      
      // External data dosyasını da kopyala (varsa)
      try {
        val dataFile = File(tempModelDir, "${CLASSIFICATION_MODEL_150_PATH}.data")
        val dataInputStream = context.assets.open("${CLASSIFICATION_MODEL_150_PATH}.data")
        val dataOutputStream = FileOutputStream(dataFile)
        dataInputStream.copyTo(dataOutputStream)
        dataInputStream.close()
        dataOutputStream.close()
      } catch (e: Exception) {
        // External data dosyası yoksa devam et
      }

      val sessionOptions = OrtSession.SessionOptions()
      sessionOptions.setIntraOpNumThreads(4)
      sessionOptions.setInterOpNumThreads(4)

      // Dosya yolundan session oluştur (external data desteği için)
      classificationSession150 = ortEnv!!.createSession(modelFile.absolutePath, sessionOptions)
      
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("LOAD_ERROR", "150-class classification model yükleme hatası: ${e.message}", e)
    }
  }

  /**
   * 150 sınıflı classification inference
   */
  @ReactMethod
  fun runClassification150(imagePath: String, promise: Promise) {
    try {
      if (classificationSession150 == null) {
        promise.reject("NOT_LOADED", "150-class classification model yüklenmemiş")
        return
      }

      val bitmap = loadBitmap(imagePath)
      val resizedBitmap = Bitmap.createScaledBitmap(bitmap, CLASSIFICATION_INPUT_SIZE, CLASSIFICATION_INPUT_SIZE, true)
      
      // Bitmap'i FloatBuffer'a çevir (NCHW format, normalized for ImageNet)
      val inputBuffer = bitmapToFloatBufferClassification(resizedBitmap, CLASSIFICATION_INPUT_SIZE, CLASSIFICATION_INPUT_SIZE)
      
      // Input tensor oluştur [1, 3, 224, 224]
      val inputShape = longArrayOf(1, 3, CLASSIFICATION_INPUT_SIZE.toLong(), CLASSIFICATION_INPUT_SIZE.toLong())
      val inputTensor = OnnxTensor.createTensor(ortEnv!!, inputBuffer, inputShape)
      
      // Inference çalıştır
      val inputs = mapOf("pixel_values" to inputTensor)
      val outputs = classificationSession150!!.run(inputs)
      
      // Output'u parse et (ViT format: [1, 150])
      val outputNames = classificationSession150!!.outputNames
      val outputName = outputNames.iterator().next()
      val outputOptional = outputs[outputName]
      val outputValue = if (outputOptional is Optional<*>) {
        outputOptional.orElse(null) as? OnnxValue
      } else {
        outputOptional as? OnnxValue
      } ?: throw Exception("Output '$outputName' bulunamadı")
      val outputTensor = outputValue as OnnxTensor
      val outputData = outputTensor.floatBuffer.array()
      
      // Softmax uygula ve en yüksek sınıfı bul
      val classification = parseClassificationOutput(outputData)
      
      // Cleanup
      inputTensor.close()
      outputTensor.close()
      outputs.close()
      
      val result = WritableNativeMap()
      result.putInt("classIndex", classification.classIndex)
      result.putDouble("confidence", classification.confidence.toDouble())
      
      val allPredictions = WritableNativeArray()
      classification.allPredictions.forEach { pred ->
        val predMap = WritableNativeMap()
        predMap.putInt("index", pred.index)
        predMap.putDouble("confidence", pred.confidence.toDouble())
        allPredictions.pushMap(predMap)
      }
      result.putArray("allPredictions", allPredictions)
      
      promise.resolve(result)
    } catch (e: Exception) {
      promise.reject("INFERENCE_ERROR", "150-class classification inference hatası: ${e.message}", e)
    }
  }

  /**
   * Detection bounding box'a göre görüntüyü kırp ve 150 sınıflı classification yap
   */
  @ReactMethod
  fun runClassificationWithCrop150(imagePath: String, bboxX: Double, bboxY: Double, bboxWidth: Double, bboxHeight: Double, promise: Promise) {
    try {
      if (classificationSession150 == null) {
        promise.reject("NOT_LOADED", "150-class classification model yüklenmemiş")
        return
      }

      val bitmap = loadBitmap(imagePath)
      val originalWidth = bitmap.width
      val originalHeight = bitmap.height
      
      android.util.Log.d("MLTestModule", "runClassificationWithCrop150: original=${originalWidth}x${originalHeight}, bbox=($bboxX,$bboxY,$bboxWidth,$bboxHeight)")
      
      // Detection output'u zaten 640x640 koordinatlarında (DETECTION_INPUT_SIZE ile çarpılmış)
      // Orijinal görüntü boyutuna göre ölçekle
      // Not: bboxX, bboxY, bboxWidth, bboxHeight zaten 640x640 koordinatlarında
      
      // Bounding box değerlerinin geçerli olduğundan emin ol
      if (bboxX < 0 || bboxY < 0 || bboxWidth <= 0 || bboxHeight <= 0) {
        android.util.Log.e("MLTestModule", "Invalid bbox values: x=$bboxX, y=$bboxY, w=$bboxWidth, h=$bboxHeight")
        promise.reject("INVALID_BBOX", "Geçersiz bounding box değerleri: x=$bboxX, y=$bboxY, w=$bboxWidth, h=$bboxHeight")
        return
      }
      
      // Bounding box değerlerinin makul aralıkta olduğundan emin ol (640x640 içinde)
      if (bboxX > DETECTION_INPUT_SIZE || bboxY > DETECTION_INPUT_SIZE || 
          bboxWidth > DETECTION_INPUT_SIZE || bboxHeight > DETECTION_INPUT_SIZE) {
        android.util.Log.e("MLTestModule", "Bbox values out of range (should be <= $DETECTION_INPUT_SIZE): x=$bboxX, y=$bboxY, w=$bboxWidth, h=$bboxHeight")
        promise.reject("INVALID_BBOX", "Bounding box değerleri aralık dışında: x=$bboxX, y=$bboxY, w=$bboxWidth, h=$bboxHeight")
        return
      }
      
      val scaleX = originalWidth.toFloat() / DETECTION_INPUT_SIZE
      val scaleY = originalHeight.toFloat() / DETECTION_INPUT_SIZE
      
      android.util.Log.d("MLTestModule", "Scale factors: scaleX=$scaleX, scaleY=$scaleY")
      
      // Bounding box koordinatlarını ölçekle (zaten 640x640 koordinatlarında)
      var x = (bboxX * scaleX).toInt().coerceAtLeast(0)
      var y = (bboxY * scaleY).toInt().coerceAtLeast(0)
      var width = (bboxWidth * scaleX).toInt().coerceAtLeast(1)
      var height = (bboxHeight * scaleY).toInt().coerceAtLeast(1)
      
      android.util.Log.d("MLTestModule", "Scaled coordinates: x=$x, y=$y, width=$width, height=$height")
      
      // Sınırları kontrol et ve düzelt
      if (x + width > originalWidth) {
        width = originalWidth - x
      }
      if (y + height > originalHeight) {
        height = originalHeight - y
      }
      
      // Minimum boyut kontrolü
      if (width <= 0 || height <= 0 || x >= originalWidth || y >= originalHeight) {
        android.util.Log.e("MLTestModule", "Invalid crop dimensions: x=$x, y=$y, width=$width, height=$height, original=${originalWidth}x${originalHeight}")
        promise.reject("INVALID_CROP", "Geçersiz crop boyutları: x=$x, y=$y, width=$width, height=$height")
        return
      }
      
      // Padding ekle (10% margin)
      val paddingX = (width * 0.1f).toInt().coerceAtLeast(1)
      val paddingY = (height * 0.1f).toInt().coerceAtLeast(1)
      var cropX = (x - paddingX).coerceAtLeast(0)
      var cropY = (y - paddingY).coerceAtLeast(0)
      var cropWidth = (width + paddingX * 2).coerceAtLeast(1)
      var cropHeight = (height + paddingY * 2).coerceAtLeast(1)
      
      // Padding ile sınırları kontrol et
      if (cropX + cropWidth > originalWidth) {
        cropWidth = originalWidth - cropX
      }
      if (cropY + cropHeight > originalHeight) {
        cropHeight = originalHeight - cropY
      }
      
      android.util.Log.d("MLTestModule", "Crop coordinates: x=$x, y=$y, width=$width, height=$height")
      android.util.Log.d("MLTestModule", "Crop with padding: cropX=$cropX, cropY=$cropY, cropWidth=$cropWidth, cropHeight=$cropHeight")
      
      // Final kontrol
      if (cropWidth <= 0 || cropHeight <= 0 || cropX >= originalWidth || cropY >= originalHeight) {
        android.util.Log.e("MLTestModule", "Invalid final crop dimensions: cropX=$cropX, cropY=$cropY, cropWidth=$cropWidth, cropHeight=$cropHeight")
        promise.reject("INVALID_CROP", "Geçersiz final crop boyutları: cropWidth=$cropWidth, cropHeight=$cropHeight")
        return
      }
      
      val croppedBitmap = Bitmap.createBitmap(bitmap, cropX, cropY, cropWidth, cropHeight)
      val resizedBitmap = Bitmap.createScaledBitmap(croppedBitmap, CLASSIFICATION_INPUT_SIZE, CLASSIFICATION_INPUT_SIZE, true)
      
      android.util.Log.d("MLTestModule", "Classification with crop 150: original=${originalWidth}x${originalHeight}, bbox=($x,$y,$width,$height), crop=($cropX,$cropY,$cropWidth,$cropHeight)")
      
      // Bitmap'i FloatBuffer'a çevir
      val inputBuffer = bitmapToFloatBufferClassification(resizedBitmap, CLASSIFICATION_INPUT_SIZE, CLASSIFICATION_INPUT_SIZE)
      
      // Input tensor oluştur [1, 3, 224, 224]
      val inputShape = longArrayOf(1, 3, CLASSIFICATION_INPUT_SIZE.toLong(), CLASSIFICATION_INPUT_SIZE.toLong())
      val inputTensor = OnnxTensor.createTensor(ortEnv!!, inputBuffer, inputShape)
      
      // Inference çalıştır (150 sınıflı model)
      val inputs = mapOf("pixel_values" to inputTensor)
      val outputs = classificationSession150!!.run(inputs)
      
      // Output'u parse et
      val outputNames = classificationSession150!!.outputNames
      val outputName = outputNames.iterator().next()
      val outputOptional = outputs[outputName]
      val outputValue = if (outputOptional is Optional<*>) {
        outputOptional.orElse(null) as? OnnxValue
      } else {
        outputOptional as? OnnxValue
      } ?: throw Exception("Output '$outputName' bulunamadı")
      val outputTensor = outputValue as OnnxTensor
      val outputData = outputTensor.floatBuffer.array()
      
      // Softmax uygula ve en yüksek sınıfı bul
      val classification = parseClassificationOutput(outputData)
      
      // Cleanup
      inputTensor.close()
      outputTensor.close()
      outputs.close()
      croppedBitmap.recycle()
      resizedBitmap.recycle()
      
      val result = WritableNativeMap()
      result.putInt("classIndex", classification.classIndex)
      result.putDouble("confidence", classification.confidence.toDouble())
      
      val allPredictions = WritableNativeArray()
      classification.allPredictions.forEach { pred ->
        val predMap = WritableNativeMap()
        predMap.putInt("index", pred.index)
        predMap.putDouble("confidence", pred.confidence.toDouble())
        allPredictions.pushMap(predMap)
      }
      result.putArray("allPredictions", allPredictions)
      
      promise.resolve(result)
    } catch (e: Exception) {
      promise.reject("INFERENCE_ERROR", "150-class classification with crop hatası: ${e.message}", e)
    }
  }

  /**
   * Detection bounding box'a göre görüntüyü kırp ve classification yap
   */
  @ReactMethod
  fun runClassificationWithCrop(imagePath: String, bboxX: Double, bboxY: Double, bboxWidth: Double, bboxHeight: Double, promise: Promise) {
    try {
      if (classificationSession == null) {
        promise.reject("NOT_LOADED", "Classification model yüklenmemiş")
        return
      }

      val bitmap = loadBitmap(imagePath)
      val originalWidth = bitmap.width
      val originalHeight = bitmap.height
      
      android.util.Log.d("MLTestModule", "runClassificationWithCrop: original=${originalWidth}x${originalHeight}, bbox=($bboxX,$bboxY,$bboxWidth,$bboxHeight)")
      
      // Detection output'u zaten 640x640 koordinatlarında (DETECTION_INPUT_SIZE ile çarpılmış)
      // Orijinal görüntü boyutuna göre ölçekle
      // Not: bboxX, bboxY, bboxWidth, bboxHeight zaten 640x640 koordinatlarında
      
      // Bounding box değerlerinin geçerli olduğundan emin ol
      if (bboxX < 0 || bboxY < 0 || bboxWidth <= 0 || bboxHeight <= 0) {
        android.util.Log.e("MLTestModule", "Invalid bbox values: x=$bboxX, y=$bboxY, w=$bboxWidth, h=$bboxHeight")
        promise.reject("INVALID_BBOX", "Geçersiz bounding box değerleri: x=$bboxX, y=$bboxY, w=$bboxWidth, h=$bboxHeight")
        return
      }
      
      // Bounding box değerlerinin makul aralıkta olduğundan emin ol (640x640 içinde)
      if (bboxX > DETECTION_INPUT_SIZE || bboxY > DETECTION_INPUT_SIZE || 
          bboxWidth > DETECTION_INPUT_SIZE || bboxHeight > DETECTION_INPUT_SIZE) {
        android.util.Log.e("MLTestModule", "Bbox values out of range (should be <= $DETECTION_INPUT_SIZE): x=$bboxX, y=$bboxY, w=$bboxWidth, h=$bboxHeight")
        promise.reject("INVALID_BBOX", "Bounding box değerleri aralık dışında: x=$bboxX, y=$bboxY, w=$bboxWidth, h=$bboxHeight")
        return
      }
      
      val scaleX = originalWidth.toFloat() / DETECTION_INPUT_SIZE
      val scaleY = originalHeight.toFloat() / DETECTION_INPUT_SIZE
      
      android.util.Log.d("MLTestModule", "Scale factors: scaleX=$scaleX, scaleY=$scaleY")
      
      // Bounding box koordinatlarını ölçekle (zaten 640x640 koordinatlarında)
      var x = (bboxX * scaleX).toInt().coerceAtLeast(0)
      var y = (bboxY * scaleY).toInt().coerceAtLeast(0)
      var width = (bboxWidth * scaleX).toInt().coerceAtLeast(1)
      var height = (bboxHeight * scaleY).toInt().coerceAtLeast(1)
      
      android.util.Log.d("MLTestModule", "Scaled coordinates: x=$x, y=$y, width=$width, height=$height")
      
      // Sınırları kontrol et ve düzelt
      if (x + width > originalWidth) {
        width = originalWidth - x
      }
      if (y + height > originalHeight) {
        height = originalHeight - y
      }
      
      // Minimum boyut kontrolü
      if (width <= 0 || height <= 0 || x >= originalWidth || y >= originalHeight) {
        android.util.Log.e("MLTestModule", "Invalid crop dimensions: x=$x, y=$y, width=$width, height=$height, original=${originalWidth}x${originalHeight}")
        promise.reject("INVALID_CROP", "Geçersiz crop boyutları: x=$x, y=$y, width=$width, height=$height")
        return
      }
      
      // Padding ekle (10% margin)
      val paddingX = (width * 0.1f).toInt().coerceAtLeast(1)
      val paddingY = (height * 0.1f).toInt().coerceAtLeast(1)
      var cropX = (x - paddingX).coerceAtLeast(0)
      var cropY = (y - paddingY).coerceAtLeast(0)
      var cropWidth = (width + paddingX * 2).coerceAtLeast(1)
      var cropHeight = (height + paddingY * 2).coerceAtLeast(1)
      
      // Padding ile sınırları kontrol et
      if (cropX + cropWidth > originalWidth) {
        cropWidth = originalWidth - cropX
      }
      if (cropY + cropHeight > originalHeight) {
        cropHeight = originalHeight - cropY
      }
      
      android.util.Log.d("MLTestModule", "Crop coordinates: x=$x, y=$y, width=$width, height=$height")
      android.util.Log.d("MLTestModule", "Crop with padding: cropX=$cropX, cropY=$cropY, cropWidth=$cropWidth, cropHeight=$cropHeight")
      
      // Final kontrol
      if (cropWidth <= 0 || cropHeight <= 0 || cropX >= originalWidth || cropY >= originalHeight) {
        android.util.Log.e("MLTestModule", "Invalid final crop dimensions: cropX=$cropX, cropY=$cropY, cropWidth=$cropWidth, cropHeight=$cropHeight")
        promise.reject("INVALID_CROP", "Geçersiz final crop boyutları: cropWidth=$cropWidth, cropHeight=$cropHeight")
        return
      }
      
      val croppedBitmap = Bitmap.createBitmap(bitmap, cropX, cropY, cropWidth, cropHeight)
      val resizedBitmap = Bitmap.createScaledBitmap(croppedBitmap, CLASSIFICATION_INPUT_SIZE, CLASSIFICATION_INPUT_SIZE, true)
      
      android.util.Log.d("MLTestModule", "Classification with crop: original=${originalWidth}x${originalHeight}, bbox=($x,$y,$width,$height), crop=($cropX,$cropY,$cropWidth,$cropHeight)")
      
      // Bitmap'i FloatBuffer'a çevir
      val inputBuffer = bitmapToFloatBufferClassification(resizedBitmap, CLASSIFICATION_INPUT_SIZE, CLASSIFICATION_INPUT_SIZE)
      
      // Input tensor oluştur [1, 3, 224, 224]
      val inputShape = longArrayOf(1, 3, CLASSIFICATION_INPUT_SIZE.toLong(), CLASSIFICATION_INPUT_SIZE.toLong())
      val inputTensor = OnnxTensor.createTensor(ortEnv!!, inputBuffer, inputShape)
      
      // Inference çalıştır
      val inputs = mapOf("pixel_values" to inputTensor)
      val outputs = classificationSession!!.run(inputs)
      
      // Output'u parse et
      val outputNames = classificationSession!!.outputNames
      val outputName = outputNames.iterator().next()
      val outputOptional = outputs[outputName]
      val outputValue = if (outputOptional is Optional<*>) {
        outputOptional.orElse(null) as? OnnxValue
      } else {
        outputOptional as? OnnxValue
      } ?: throw Exception("Output '$outputName' bulunamadı")
      val outputTensor = outputValue as OnnxTensor
      val outputData = outputTensor.floatBuffer.array()
      
      // Softmax uygula ve en yüksek sınıfı bul
      val classification = parseClassificationOutput(outputData)
      
      // Cleanup
      inputTensor.close()
      outputTensor.close()
      outputs.close()
      croppedBitmap.recycle()
      resizedBitmap.recycle()
      
      val result = WritableNativeMap()
      result.putInt("classIndex", classification.classIndex)
      result.putDouble("confidence", classification.confidence.toDouble())
      
      val allPredictions = WritableNativeArray()
      classification.allPredictions.forEach { pred ->
        val predMap = WritableNativeMap()
        predMap.putInt("index", pred.index)
        predMap.putDouble("confidence", pred.confidence.toDouble())
        allPredictions.pushMap(predMap)
      }
      result.putArray("allPredictions", allPredictions)
      
      promise.resolve(result)
    } catch (e: Exception) {
      promise.reject("INFERENCE_ERROR", "Classification with crop hatası: ${e.message}", e)
    }
  }

  /**
   * Modelleri temizle
   */
  @ReactMethod
  fun dispose() {
    detectionSession?.close()
    classificationSession?.close()
    classificationSession150?.close()
    detectionSession = null
    classificationSession = null
    classificationSession150 = null
    
    // Geçici dosyaları temizle
    tempModelDir?.deleteRecursively()
    tempModelDir = null
  }

  /**
   * Bitmap yükle (file:// veya content:// URI'leri destekle)
   */
  private fun loadBitmap(imagePath: String): Bitmap {
    val uri = Uri.parse(imagePath)
    val context = reactApplicationContext
    
    return when {
      imagePath.startsWith("content://") -> {
        val inputStream: InputStream? = context.contentResolver.openInputStream(uri)
        BitmapFactory.decodeStream(inputStream) ?: throw Exception("Bitmap decode edilemedi")
      }
      imagePath.startsWith("file://") -> {
        BitmapFactory.decodeFile(imagePath.replace("file://", ""))
          ?: throw Exception("Bitmap decode edilemedi")
      }
      else -> {
        BitmapFactory.decodeFile(imagePath)
          ?: throw Exception("Bitmap decode edilemedi")
      }
    }
  }

  /**
   * Bitmap'i FloatBuffer'a çevir (Detection için - YOLOv8)
   * Format: NCHW, Normalized [0, 1]
   */
  private fun bitmapToFloatBuffer(bitmap: Bitmap, width: Int, height: Int): FloatBuffer {
    val buffer = ByteBuffer.allocateDirect(width * height * 3 * 4)
    buffer.order(ByteOrder.nativeOrder())
    val floatBuffer = buffer.asFloatBuffer()
    
    val pixels = IntArray(width * height)
    bitmap.getPixels(pixels, 0, width, 0, 0, width, height)
    
    // NCHW format: önce tüm R, sonra tüm G, sonra tüm B
    for (c in 0 until 3) {
      for (y in 0 until height) {
        for (x in 0 until width) {
          val pixel = pixels[y * width + x]
          val value = when (c) {
            0 -> ((pixel shr 16) and 0xFF) / 255.0f // R
            1 -> ((pixel shr 8) and 0xFF) / 255.0f  // G
            else -> (pixel and 0xFF) / 255.0f       // B
          }
          floatBuffer.put(value)
        }
      }
    }
    
    floatBuffer.rewind()
    return floatBuffer
  }

  /**
   * Bitmap'i FloatBuffer'a çevir (Classification için - ViT)
   * Format: NCHW, Model-specific normalization (mean=[0.5,0.5,0.5], std=[0.5,0.5,0.5])
   * Preprocessor config'e göre: rescale_factor=1/255, mean=0.5, std=0.5
   */
  private fun bitmapToFloatBufferClassification(bitmap: Bitmap, width: Int, height: Int): FloatBuffer {
    val buffer = ByteBuffer.allocateDirect(width * height * 3 * 4)
    buffer.order(ByteOrder.nativeOrder())
    val floatBuffer = buffer.asFloatBuffer()
    
    val pixels = IntArray(width * height)
    bitmap.getPixels(pixels, 0, width, 0, 0, width, height)
    
    // Model-specific mean ve std (preprocessor_config.json'dan)
    val mean = floatArrayOf(0.5f, 0.5f, 0.5f)
    val std = floatArrayOf(0.5f, 0.5f, 0.5f)
    
    // NCHW format
    for (c in 0 until 3) {
      for (y in 0 until height) {
        for (x in 0 until width) {
          val pixel = pixels[y * width + x]
          // Rescale: pixel / 255.0 (0-1 arasına getir)
          val value = when (c) {
            0 -> ((pixel shr 16) and 0xFF) / 255.0f // R
            1 -> ((pixel shr 8) and 0xFF) / 255.0f  // G
            else -> (pixel and 0xFF) / 255.0f       // B
          }
          // Normalize: (value - mean) / std
          val normalized = (value - mean[c]) / std[c]
          floatBuffer.put(normalized)
        }
      }
    }
    
    floatBuffer.rewind()
    return floatBuffer
  }

  /**
   * YOLOv8 output'unu parse et
   * Format: [1, 8400, 16] veya [1, 16, 8400]
   * YOLOv8'de her detection için: [x_center, y_center, width, height, class_score_0, class_score_1, ..., class_score_11]
   * Confidence = max(class_scores) (YOLOv8'de ayrı objectness confidence yok)
   */
  private fun parseYOLOOutput(outputData: FloatArray, shape: LongArray): Detection? {
    android.util.Log.d("MLTestModule", "parseYOLOOutput - shape: ${shape.contentToString()}, data size: ${outputData.size}")
    
    if (shape.size != 3 || shape[0] != 1L) {
      android.util.Log.e("MLTestModule", "Invalid shape: ${shape.contentToString()}")
      return null
    }
    
    // YOLOv8 output format: [1, 8400, 16] veya [1, 16, 8400]
    val isTransposed = shape[1] < shape[2] // [1, 16, 8400] format
    val numDetections = if (isTransposed) shape[2].toInt() else shape[1].toInt()
    val numValues = if (isTransposed) shape[1].toInt() else shape[2].toInt()
    
    android.util.Log.d("MLTestModule", "numDetections: $numDetections, numValues: $numValues, isTransposed: $isTransposed")
    
    // YOLOv8 format: 4 (bbox) + 12 (class scores) = 16
    val numClasses = numValues - 4
    
    var bestConfidence = 0.0f
    var bestDetection: Detection? = null
    val confThreshold = 0.1f // Düşük threshold (YOLOv8 class scores genellikle düşük)
    
    // İlk birkaç detection'ın değerlerini logla (debug için)
    val sampleSize = minOf(5, numDetections)
    for (sampleIdx in 0 until sampleSize) {
      if (isTransposed) {
        val x = outputData[0 * numDetections + sampleIdx]
        val y = outputData[1 * numDetections + sampleIdx]
        val w = outputData[2 * numDetections + sampleIdx]
        val h = outputData[3 * numDetections + sampleIdx]
        // Class scores'ları al (4'ten başlayarak)
        var maxClassScore = 0.0f
        for (c in 0 until numClasses) {
          val score = outputData[(4 + c) * numDetections + sampleIdx]
          if (score > maxClassScore) maxClassScore = score
        }
        android.util.Log.d("MLTestModule", "Sample[$sampleIdx]: x=$x, y=$y, w=$w, h=$h, maxClassScore=$maxClassScore")
      } else {
        val offset = sampleIdx * numValues
        val x = outputData[offset]
        val y = outputData[offset + 1]
        val w = outputData[offset + 2]
        val h = outputData[offset + 3]
        // Class scores'ları al (4'ten başlayarak)
        var maxClassScore = 0.0f
        for (c in 0 until numClasses) {
          val score = outputData[offset + 4 + c]
          if (score > maxClassScore) maxClassScore = score
        }
        android.util.Log.d("MLTestModule", "Sample[$sampleIdx]: x=$x, y=$y, w=$w, h=$h, maxClassScore=$maxClassScore")
      }
    }
    
    for (i in 0 until numDetections) {
      val x: Float
      val y: Float
      val w: Float
      val h: Float
      val conf: Float
      
      if (isTransposed) {
        // Transposed format: [1, 16, 8400]
        // x, y, w, h: indices 0, 1, 2, 3
        // class scores: indices 4, 5, ..., 15
        if ((numValues - 1) * numDetections + i >= outputData.size) {
          break
        }
        x = outputData[0 * numDetections + i]
        y = outputData[1 * numDetections + i]
        w = outputData[2 * numDetections + i]
        h = outputData[3 * numDetections + i]
        
        // Class scores'ların maksimumunu confidence olarak kullan
        var maxClassScore = Float.NEGATIVE_INFINITY
        for (c in 0 until numClasses) {
          val score = outputData[(4 + c) * numDetections + i]
          if (score > maxClassScore) maxClassScore = score
        }
        conf = maxClassScore
      } else {
        // Normal format: [1, 8400, 16]
        val offset = i * numValues
        if (offset + numValues > outputData.size) {
          break
        }
        x = outputData[offset]
        y = outputData[offset + 1]
        w = outputData[offset + 2]
        h = outputData[offset + 3]
        
        // Class scores'ların maksimumunu confidence olarak kullan
        var maxClassScore = Float.NEGATIVE_INFINITY
        for (c in 0 until numClasses) {
          val score = outputData[offset + 4 + c]
          if (score > maxClassScore) maxClassScore = score
        }
        conf = maxClassScore
      }
      
      // Confidence threshold ve en iyi detection'ı bul
      if (conf > confThreshold && conf > bestConfidence) {
        bestConfidence = conf
        // YOLOv8 normalize koordinatları (0-1) 640x640'e ölçekle
        // Format: [x_center, y_center, width, height] normalize (0-1)
        // Eğer değerler zaten 1'den büyükse, normalize değil demektir (zaten pixel koordinatları)
        val xCenter = if (x > 1.0f) x else x * DETECTION_INPUT_SIZE
        val yCenter = if (y > 1.0f) y else y * DETECTION_INPUT_SIZE
        val bboxWidth = if (w > 1.0f) w else w * DETECTION_INPUT_SIZE
        val bboxHeight = if (h > 1.0f) h else h * DETECTION_INPUT_SIZE
        
        // Center koordinatlarını sol üst köşe koordinatlarına çevir
        // x1 = x_center - width/2, y1 = y_center - height/2
        val x1 = (xCenter - bboxWidth / 2f).coerceAtLeast(0f)
        val y1 = (yCenter - bboxHeight / 2f).coerceAtLeast(0f)
        val finalWidth = bboxWidth.coerceIn(1f, DETECTION_INPUT_SIZE.toFloat() - x1)
        val finalHeight = bboxHeight.coerceIn(1f, DETECTION_INPUT_SIZE.toFloat() - y1)
        
        android.util.Log.d("MLTestModule", "Found detection: conf=$conf, raw(x_center=$x, y_center=$y, w=$w, h=$h)")
        android.util.Log.d("MLTestModule", "Scaled center: x_center=$xCenter, y_center=$yCenter, w=$bboxWidth, h=$bboxHeight")
        android.util.Log.d("MLTestModule", "Final detection coordinates (x1,y1): x=$x1, y=$y1, w=$finalWidth, h=$finalHeight")
        
        bestDetection = Detection(
          x = x1,
          y = y1,
          width = finalWidth,
          height = finalHeight,
          confidence = conf
        )
      }
    }
    
    android.util.Log.d("MLTestModule", "Best detection: ${if (bestDetection != null) "found (conf=${bestDetection.confidence})" else "not found (bestConf=$bestConfidence, threshold=$confThreshold)"}")
    return bestDetection
  }

  /**
   * Classification output'unu parse et ve softmax uygula
   * Format: [1, 12] - 12 sınıf için logits
   */
  private fun parseClassificationOutput(outputData: FloatArray): ClassificationResult {
    // Softmax uygula
    val expValues = outputData.map { kotlin.math.exp(it) }
    val sum = expValues.sum()
    val probabilities = expValues.map { it / sum }
    
    // En yüksek olasılıklı sınıfı bul
    var maxIndex = 0
    var maxProb = probabilities[0]
    for (i in 1 until probabilities.size) {
      if (probabilities[i] > maxProb) {
        maxProb = probabilities[i]
        maxIndex = i
      }
    }
    
    // Tüm tahminleri sırala
    val allPredictions = probabilities.mapIndexed { index, prob ->
      Prediction(index, prob)
    }.sortedByDescending { it.confidence }
    
    return ClassificationResult(
      classIndex = maxIndex,
      confidence = maxProb,
      allPredictions = allPredictions
    )
  }

  data class Detection(
    val x: Float,
    val y: Float,
    val width: Float,
    val height: Float,
    val confidence: Float
  )

  data class ClassificationResult(
    val classIndex: Int,
    val confidence: Float,
    val allPredictions: List<Prediction>
  )

  data class Prediction(
    val index: Int,
    val confidence: Float
  )
}

