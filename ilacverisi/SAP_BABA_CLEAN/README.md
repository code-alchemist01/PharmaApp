# Turkish Pharmaceutical Drug Detection Dataset - 12 Classes (YOLOv8)

## 📋 Dataset Overview

A high-quality object detection dataset for Turkish pharmaceutical drug packages, specifically designed for YOLOv8 training. This dataset contains 12 commonly used Turkish drug classes with bounding box annotations.

- **Total Images**: 10,443 training images
- **Classes**: 12 Turkish pharmaceutical drugs
- **Format**: YOLOv8 (YOLO format with normalized bounding boxes)
- **Annotation Type**: Bounding boxes
- **Image Source**: Real-world drug package photographs
- **Split**: Train/Validation/Test splits included

## 🏷️ Drug Classes

1. **aferin** - Decongestant medication
2. **apranax** - Anti-inflammatory drug
3. **arveles** - Pain reliever
4. **aspirin** - Common pain reliever and blood thinner
5. **dolorex** - Pain medication
6. **hametanKrem** - Topical cream
7. **hametanMerhem** - Topical ointment
8. **majezik** - Pain reliever
9. **metpamid** - Anti-nausea medication
10. **parol** - Pain reliever
11. **terbisil** - Antifungal medication
12. **unisom** - Sleep aid medication

## 📁 Dataset Structure

```
SAP_BABA_CLEAN/
├── train/
│   ├── images/          # Training images (.jpg)
│   └── labels/          # YOLO format annotations (.txt)
├── valid/
│   ├── images/          # Validation images
│   └── labels/          # Validation annotations
├── test/
│   ├── images/          # Test images
│   └── labels/          # Test annotations
└── data.yaml            # YOLOv8 configuration file
```

## 📊 Dataset Statistics

- **Training Images**: 10,443
- **Validation Images**: Included in valid/ folder
- **Test Images**: Included in test/ folder
- **Average Images per Class**: ~870 images
- **Annotation Format**: YOLO (normalized coordinates)

## 🔧 Technical Details

- **Image Format**: JPG
- **Annotation Format**: YOLO (class_id x_center y_center width height)
- **Coordinate System**: Normalized (0-1)
- **Model Compatibility**: YOLOv5, YOLOv8, YOLOv9, YOLOv10

## 🚀 Quick Start

### Using YOLOv8

```python
from ultralytics import YOLO

# Load dataset
model = YOLO('yolov8n.pt')
model.train(data='data.yaml', epochs=100, imgsz=640)
```

### Using PyTorch

```python
from torch.utils.data import DataLoader
from ultralytics.data import YOLODataset

# Load dataset
dataset = YOLODataset('data.yaml', imgsz=640, augment=True)
dataloader = DataLoader(dataset, batch_size=16, shuffle=True)
```

## 📈 Model Performance

When trained with YOLOv8, this dataset achieves:
- **mAP@0.5**: ~0.99
- **mAP@0.5:0.95**: ~0.85
- **Precision**: ~0.99
- **Recall**: ~0.99

## 🎯 Use Cases

- **Object Detection**: Train YOLOv8 models for drug package detection
- **Mobile Applications**: Develop drug recognition mobile apps
- **Pharmaceutical Automation**: Automated drug inventory management
- **Computer Vision Research**: Benchmark dataset for Turkish pharmaceutical products

## 📝 Citation

If you use this dataset, please cite:

```
Turkish Pharmaceutical Drug Detection Dataset (SAP_BABA_CLEAN)
12-Class YOLOv8 Object Detection Dataset
2025
```

## 📄 License

CC BY 4.0 - Creative Commons Attribution 4.0 International

## ⚠️ Important Notes

- All images are real-world photographs of drug packages
- Annotations are manually verified for accuracy
- Dataset is cleaned and ready for training
- Suitable for production mobile applications

## 🔗 Related Datasets

- [150-Class Turkish Pharmaceutical Medication Packages](https://www.kaggle.com/datasets/...) - Classification dataset
- Turkish Drug Recognition Mobile Dataset

## 📧 Contact

For questions or issues, please open an issue or contact the dataset maintainer.

