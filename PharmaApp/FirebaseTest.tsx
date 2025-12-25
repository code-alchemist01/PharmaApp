/**
 * Firebase Bağlantı Testi
 * Bu dosya Firebase'in düzgün çalışıp çalışmadığını test eder
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';

function FirebaseTest(): React.JSX.Element {
  const [authStatus, setAuthStatus] = useState<string>('Kontrol ediliyor...');
  const [firestoreStatus, setFirestoreStatus] = useState<string>('Kontrol ediliyor...');
  const [testResult, setTestResult] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    testFirebase();
  }, []);

  const testFirebase = async () => {
    try {
      // Firebase modüllerini dinamik import et
      const auth = require('@react-native-firebase/auth').default;
      const firestore = require('@react-native-firebase/firestore').default;

      // 1. Auth Test
      try {
        const authApp = auth();
        setAuthStatus('✓ Auth bağlantısı başarılı');
      } catch (err: any) {
        setAuthStatus(`✗ Auth hatası: ${err?.message || 'Bilinmeyen hata'}`);
      }

      // 2. Firestore Test
      try {
        const db = firestore();
        
        // Test koleksiyonuna yazma
        await db.collection('_test').doc('connection').set({
          timestamp: new Date().toISOString(),
          message: 'Firebase test başarılı',
        });

        // Test koleksiyonundan okuma
        const doc = await db.collection('_test').doc('connection').get();
        
        if (doc.exists) {
          setFirestoreStatus('✓ Firestore bağlantısı başarılı');
          setTestResult('✓ Firebase tamamen çalışıyor!');
          
          // Test verisini sil
          await db.collection('_test').doc('connection').delete();
        } else {
          setFirestoreStatus('✗ Firestore: Veri okunamadı');
        }
      } catch (err: any) {
        setFirestoreStatus(`✗ Firestore hatası: ${err?.message || 'Bilinmeyen hata'}`);
        setTestResult('✗ Firebase bağlantı hatası');
      }
    } catch (err: any) {
      const errorMsg = err?.message || 'Bilinmeyen hata';
      setError(`✗ Genel hata: ${errorMsg}`);
      setTestResult(`✗ Hata: ${errorMsg}`);
    }
  };

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>Firebase Test</Text>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Firebase Bağlantı Testi</Text>
        
        {!testResult && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1685f3" />
            <Text style={styles.loadingText}>Test ediliyor...</Text>
          </View>
        )}
        
        <View style={styles.section}>
          <Text style={styles.label}>Authentication:</Text>
          <Text style={styles.status}>{authStatus}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Firestore:</Text>
          <Text style={styles.status}>{firestoreStatus}</Text>
        </View>

        {testResult ? (
          <View style={styles.resultSection}>
            <Text style={styles.resultLabel}>Sonuç:</Text>
            <Text style={styles.result}>{testResult}</Text>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7f8',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
    textAlign: 'center',
    color: '#111418',
  },
  section: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: 'white',
    borderRadius: 10,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#111418',
  },
  status: {
    fontSize: 14,
    color: '#60758a',
  },
  resultSection: {
    marginTop: 20,
    padding: 20,
    backgroundColor: '#1685f3',
    borderRadius: 10,
  },
  resultLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: 'white',
  },
  result: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  loadingContainer: {
    alignItems: 'center',
    marginVertical: 30,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#60758a',
  },
  errorText: {
    fontSize: 16,
    color: '#d32f2f',
    marginTop: 20,
    textAlign: 'center',
  },
});

export default FirebaseTest;

