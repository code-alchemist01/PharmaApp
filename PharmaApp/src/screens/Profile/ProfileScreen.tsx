/**
 * ProfileScreen - Profil ekranı (Geliştirilmiş)
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Image, Alert } from 'react-native';
import {
  Text,
  Card,
  Button,
  List,
  TextInput,
  Dialog,
  Portal,
  Switch,
  Avatar,
  Divider,
  ActivityIndicator,
} from 'react-native-paper';
import { launchImageLibrary, ImagePickerResponse } from 'react-native-image-picker';
import { useAuth } from '../../context/AuthContext';
import FirestoreService from '../../services/database/FirestoreService';
import { requestMediaPermission } from '../../utils/helpers';

const ProfileScreen: React.FC = () => {
  const { user, signOut, updateProfile, changePassword, updateProfilePhoto } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [dialogMessage, setDialogMessage] = useState('');

  // Şifre değiştirme
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Bildirim ayarları
  const [notificationEnabled, setNotificationEnabled] = useState(true);
  const [reminderEnabled, setReminderEnabled] = useState(true);

  // Avatar
  const [avatarBase64, setAvatarBase64] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Avatar'ı yükle
  useEffect(() => {
    const loadAvatar = async () => {
      if (!user?.uid) return;
      try {
        const photoBase64 = await FirestoreService.getUserProfilePhoto();
        console.log('[ProfileScreen] Avatar loaded from Firestore:', photoBase64 ? 'Yes' : 'No');
        if (photoBase64) {
          setAvatarBase64(photoBase64);
        } else {
          setAvatarBase64(null);
        }
      } catch (error) {
        console.error('[ProfileScreen] Avatar yüklenemedi:', error);
        setAvatarBase64(null);
      }
    };
    loadAvatar();
  }, [user?.uid]);

  const handleSignOut = async () => {
    Alert.alert('Çıkış Yap', 'Çıkış yapmak istediğinize emin misiniz?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Çıkış Yap',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
          } catch (error) {
            console.error('Çıkış yapılamadı:', error);
          }
        },
      },
    ]);
  };

  const handleEdit = () => {
    setDisplayName(user?.displayName || '');
    setIsEditing(true);
    setError('');
  };

  const handleCancel = () => {
    setIsEditing(false);
    setDisplayName(user?.displayName || '');
    setError('');
  };

  const handleSave = async () => {
    if (!displayName.trim()) {
      setError('Ad Soyad boş olamaz');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await updateProfile(displayName.trim());
      setIsEditing(false);
      setDialogMessage('Profil başarıyla güncellendi.');
      setShowDialog(true);
    } catch (err: any) {
      setError(err.message || 'Profil güncellenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Hata', 'Tüm alanları doldurun');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Hata', 'Yeni şifreler eşleşmiyor');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Hata', 'Şifre en az 6 karakter olmalıdır');
      return;
    }

    setPasswordLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
      setShowPasswordDialog(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setDialogMessage('Şifre başarıyla değiştirildi.');
      setShowDialog(true);
    } catch (err: any) {
      Alert.alert('Hata', err.message || 'Şifre değiştirilemedi');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handlePickAvatar = async () => {
    const hasPermission = await requestMediaPermission();
    if (!hasPermission) {
      return;
    }

    launchImageLibrary(
      {
        mediaType: 'photo',
        quality: 0.8,
        maxWidth: 512,
        maxHeight: 512,
        includeBase64: true, // Base64 formatında al
      },
      async (response: ImagePickerResponse) => {
        if (response.didCancel || response.errorCode) {
          return;
        }

        const asset = response.assets?.[0];
        if (!asset?.uri || !asset.base64) {
          Alert.alert('Hata', 'Fotoğraf seçilemedi');
          return;
        }

        setUploadingAvatar(true);
        try {
          // Base64 formatını hazırla (data:image/jpeg;base64, prefix'i ekle)
          const base64String = `data:image/jpeg;base64,${asset.base64}`;

          console.log('[ProfileScreen] Uploading avatar to Firestore...');
          // Firestore'a kaydet
          await FirestoreService.updateUserProfilePhoto(base64String);
          console.log('[ProfileScreen] Avatar uploaded successfully');

          // Local state'i güncelle
          setAvatarBase64(base64String);
          console.log('[ProfileScreen] Avatar state updated');

          // Firebase Auth'da da güncelle (opsiyonel - URL yerine base64 data URI kullanabiliriz)
          // await updateProfilePhoto(base64String);

          setDialogMessage('Profil fotoğrafı başarıyla güncellendi.');
          setShowDialog(true);
        } catch (err: any) {
          Alert.alert('Hata', err.message || 'Fotoğraf yüklenemedi');
        } finally {
          setUploadingAvatar(false);
        }
      }
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          {/* Avatar ve Kullanıcı Bilgileri */}
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.avatarContainer}>
                {uploadingAvatar ? (
                  <ActivityIndicator size="large" color="#6200ee" />
                ) : avatarBase64 ? (
                  <Avatar.Image
                    size={100}
                    source={{ uri: avatarBase64 }}
                    style={styles.avatar}
                  />
                ) : (
                  <Avatar.Text
                    size={100}
                    label={user?.displayName?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'}
                    style={styles.avatar}
                  />
                )}
                <Button
                  mode="outlined"
                  onPress={handlePickAvatar}
                  disabled={uploadingAvatar}
                  style={styles.avatarButton}
                  icon="camera">
                  Fotoğraf Değiştir
                </Button>
              </View>

              <View style={styles.header}>
                <Text variant="headlineMedium" style={styles.title}>
                  Profil
                </Text>
                {!isEditing && (
                  <Button mode="text" onPress={handleEdit} icon="pencil">
                    Düzenle
                  </Button>
                )}
              </View>

              {isEditing ? (
                <View>
                  <TextInput
                    label="Ad Soyad"
                    value={displayName}
                    onChangeText={setDisplayName}
                    mode="outlined"
                    autoCapitalize="words"
                    style={styles.input}
                  />
                  {error ? <Text style={styles.errorText}>{error}</Text> : null}
                  <View style={styles.editActions}>
                    <Button
                      mode="outlined"
                      onPress={handleCancel}
                      disabled={loading}
                      style={styles.editButton}>
                      İptal
                    </Button>
                    <Button
                      mode="contained"
                      onPress={handleSave}
                      loading={loading}
                      disabled={loading}
                      style={styles.editButton}>
                      Kaydet
                    </Button>
                  </View>
                </View>
              ) : (
                <>
                  <List.Item
                    title="Ad Soyad"
                    description={user?.displayName || 'Belirtilmemiş'}
                    left={(props) => <List.Icon {...props} icon="account" />}
                  />
                  <List.Item
                    title="Email"
                    description={user?.email || 'Bilinmiyor'}
                    left={(props) => <List.Icon {...props} icon="email" />}
                  />
                </>
              )}
            </Card.Content>
          </Card>

          {/* Şifre Değiştirme */}
          {!isEditing && (
            <Card style={styles.card}>
              <Card.Content>
                <List.Item
                  title="Şifre Değiştir"
                  description="Hesap güvenliğiniz için düzenli olarak şifrenizi değiştirin"
                  left={(props) => <List.Icon {...props} icon="lock" />}
                  right={(props) => <List.Icon {...props} icon="chevron-right" />}
                  onPress={() => setShowPasswordDialog(true)}
                />
              </Card.Content>
            </Card>
          )}

          {/* Bildirim Ayarları */}
          {!isEditing && (
            <Card style={styles.card}>
              <Card.Content>
                <Text variant="titleMedium" style={styles.sectionTitle}>
                  Bildirim Ayarları
                </Text>
                <List.Item
                  title="Bildirimler"
                  description="Push bildirimlerini aç/kapat"
                  left={(props) => <List.Icon {...props} icon="notifications" />}
                  right={() => (
                    <Switch value={notificationEnabled} onValueChange={setNotificationEnabled} />
                  )}
                />
                <Divider />
                <List.Item
                  title="Hatırlatmalar"
                  description="Alarm hatırlatmalarını aç/kapat"
                  left={(props) => <List.Icon {...props} icon="alarm" />}
                  right={() => <Switch value={reminderEnabled} onValueChange={setReminderEnabled} />}
                />
              </Card.Content>
            </Card>
          )}

          {/* Uygulama Ayarları */}
          {!isEditing && (
            <Card style={styles.card}>
              <Card.Content>
                <Text variant="titleMedium" style={styles.sectionTitle}>
                  Uygulama Ayarları
                </Text>
                <List.Item
                  title="Karanlık Mod"
                  description="Karanlık temayı aç/kapat"
                  left={(props) => <List.Icon {...props} icon="theme-light-dark" />}
                  right={() => <Switch value={false} disabled />}
                />
                <Divider />
                <List.Item
                  title="Dil"
                  description="Uygulama dili"
                  left={(props) => <List.Icon {...props} icon="translate" />}
                  right={(props) => <List.Icon {...props} icon="chevron-right" />}
                  onPress={() => Alert.alert('Bilgi', 'Dil seçimi yakında eklenecek')}
                />
              </Card.Content>
            </Card>
          )}

          {/* Diğer */}
          {!isEditing && (
            <Card style={styles.card}>
              <Card.Content>
                <List.Item
                  title="Hakkında"
                  description="Uygulama versiyonu ve bilgileri"
                  left={(props) => <List.Icon {...props} icon="information" />}
                  right={(props) => <List.Icon {...props} icon="chevron-right" />}
                  onPress={() => Alert.alert('Hakkında', 'PharmaApp v0.0.1\nİlaç takip uygulaması')}
                />
              </Card.Content>
            </Card>
          )}

          {/* Çıkış Yap */}
          {!isEditing && (
            <Button
              mode="contained"
              onPress={handleSignOut}
              style={styles.signOutButton}
              buttonColor="#d32f2f">
              Çıkış Yap
            </Button>
          )}
        </View>
      </ScrollView>

      {/* Başarı Dialog */}
      <Portal>
        <Dialog visible={showDialog} onDismiss={() => setShowDialog(false)}>
          <Dialog.Title>Başarılı</Dialog.Title>
          <Dialog.Content>
            <Text>{dialogMessage}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowDialog(false)}>Tamam</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Şifre Değiştirme Dialog */}
      <Portal>
        <Dialog visible={showPasswordDialog} onDismiss={() => setShowPasswordDialog(false)}>
          <Dialog.Title>Şifre Değiştir</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Mevcut Şifre"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              mode="outlined"
              secureTextEntry
              style={styles.input}
            />
            <TextInput
              label="Yeni Şifre"
              value={newPassword}
              onChangeText={setNewPassword}
              mode="outlined"
              secureTextEntry
              style={styles.input}
            />
            <TextInput
              label="Yeni Şifre (Tekrar)"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              mode="outlined"
              secureTextEntry
              style={styles.input}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowPasswordDialog(false)} disabled={passwordLoading}>
              İptal
            </Button>
            <Button onPress={handleChangePassword} loading={passwordLoading}>
              Değiştir
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  card: {
    marginBottom: 16,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    marginBottom: 12,
  },
  avatarButton: {
    marginTop: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  input: {
    marginBottom: 16,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  editButton: {
    marginLeft: 8,
  },
  errorText: {
    color: '#d32f2f',
    marginBottom: 16,
    textAlign: 'center',
  },
  signOutButton: {
    marginTop: 16,
  },
});

export default ProfileScreen;
