/**
 * AuthService - Kimlik doğrulama servisi
 * Firebase Authentication wrapper
 */

import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { getApp } from '@react-native-firebase/app';

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
}

class AuthService {
  /**
   * Email ve şifre ile giriş yap
   */
  async signIn(email: string, password: string): Promise<FirebaseAuthTypes.User> {
    try {
      const authInstance = auth(getApp());
      const userCredential = await authInstance.signInWithEmailAndPassword(email, password);
      return userCredential.user;
    } catch (error: any) {
      throw new Error(error.message || 'Giriş yapılamadı');
    }
  }

  /**
   * Yeni kullanıcı kaydı
   */
  async signUp(email: string, password: string): Promise<FirebaseAuthTypes.User> {
    try {
      const authInstance = auth(getApp());
      const userCredential = await authInstance.createUserWithEmailAndPassword(email, password);
      return userCredential.user;
    } catch (error: any) {
      throw new Error(error.message || 'Kayıt olunamadı');
    }
  }

  /**
   * Çıkış yap
   */
  async signOut(): Promise<void> {
    try {
      const authInstance = auth(getApp());
      await authInstance.signOut();
    } catch (error: any) {
      throw new Error(error.message || 'Çıkış yapılamadı');
    }
  }

  /**
   * Şifre sıfırlama e-postası gönder
   */
  async resetPassword(email: string): Promise<void> {
    try {
      const authInstance = auth(getApp());
      await authInstance.sendPasswordResetEmail(email);
    } catch (error: any) {
      throw new Error(error.message || 'Şifre sıfırlama e-postası gönderilemedi');
    }
  }

  /**
   * Mevcut kullanıcıyı al
   */
  getCurrentUser(): FirebaseAuthTypes.User | null {
    const authInstance = auth(getApp());
    return authInstance.currentUser;
  }

  /**
   * Auth state değişikliklerini dinle
   */
  onAuthStateChanged(
    callback: (user: FirebaseAuthTypes.User | null) => void
  ): () => void {
    const authInstance = auth(getApp());
    return authInstance.onAuthStateChanged(callback);
  }

  /**
   * Email doğrulama e-postası gönder
   */
  async sendEmailVerification(): Promise<void> {
    const authInstance = auth(getApp());
    const user = authInstance.currentUser;
    if (!user) {
      throw new Error('Kullanıcı giriş yapmamış');
    }
    try {
      await user.sendEmailVerification();
    } catch (error: any) {
      throw new Error(error.message || 'Email doğrulama e-postası gönderilemedi');
    }
  }

  /**
   * Kullanıcı profilini güncelle
   */
  async updateProfile(displayName?: string, photoURL?: string): Promise<void> {
    const authInstance = auth(getApp());
    const user = authInstance.currentUser;
    if (!user) {
      throw new Error('Kullanıcı giriş yapmamış');
    }
    try {
      await user.updateProfile({
        displayName,
        photoURL,
      });
    } catch (error: any) {
      throw new Error(error.message || 'Profil güncellenemedi');
    }
  }
}

export default new AuthService();

