/**
 * AuthContext - Kullanıcı kimlik doğrulama state yönetimi
 */

import React, { createContext, useState, useEffect, ReactNode } from 'react';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { getApp } from '@react-native-firebase/app';

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName?: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateProfile: (displayName: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  updateProfilePhoto: (photoURL: string) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const authInstance = auth(getApp());
    const unsubscribe = authInstance.onAuthStateChanged((firebaseUser: FirebaseAuthTypes.User | null) => {
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string): Promise<void> => {
    try {
      const authInstance = auth(getApp());
      await authInstance.signInWithEmailAndPassword(email, password);
    } catch (error: any) {
      throw new Error(error.message || 'Giriş yapılamadı');
    }
  };

  const signUp = async (email: string, password: string, displayName?: string): Promise<void> => {
    try {
      const authInstance = auth(getApp());
      const userCredential = await authInstance.createUserWithEmailAndPassword(email, password);
      if (displayName && userCredential.user) {
        await userCredential.user.updateProfile({
          displayName: displayName,
        });
        // State'i güncelle
        setUser({
          uid: userCredential.user.uid,
          email: userCredential.user.email,
          displayName: displayName,
        });
      }
    } catch (error: any) {
      throw new Error(error.message || 'Kayıt olunamadı');
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      const authInstance = auth(getApp());
      await authInstance.signOut();
    } catch (error: any) {
      throw new Error(error.message || 'Çıkış yapılamadı');
    }
  };

  const resetPassword = async (email: string): Promise<void> => {
    try {
      const authInstance = auth(getApp());
      await authInstance.sendPasswordResetEmail(email);
    } catch (error: any) {
      throw new Error(error.message || 'Şifre sıfırlama e-postası gönderilemedi');
    }
  };

  const updateProfile = async (displayName: string): Promise<void> => {
    try {
      const authInstance = auth(getApp());
      const currentUser = authInstance.currentUser;
      if (!currentUser) {
        throw new Error('Kullanıcı giriş yapmamış');
      }

      await currentUser.updateProfile({
        displayName: displayName,
      });

      // State'i güncelle
      setUser({
        uid: currentUser.uid,
        email: currentUser.email,
        displayName: displayName,
        photoURL: currentUser.photoURL,
      });
    } catch (error: any) {
      throw new Error(error.message || 'Profil güncellenemedi');
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string): Promise<void> => {
    try {
      const authInstance = auth(getApp());
      const currentUser = authInstance.currentUser;
      if (!currentUser || !currentUser.email) {
        throw new Error('Kullanıcı giriş yapmamış');
      }

      // Mevcut şifreyi doğrula
      const credential = auth.EmailAuthProvider.credential(currentUser.email, currentPassword);
      await currentUser.reauthenticateWithCredential(credential);

      // Yeni şifreyi güncelle
      await currentUser.updatePassword(newPassword);
    } catch (error: any) {
      if (error.code === 'auth/wrong-password') {
        throw new Error('Mevcut şifre yanlış');
      } else if (error.code === 'auth/weak-password') {
        throw new Error('Yeni şifre çok zayıf (en az 6 karakter)');
      }
      throw new Error(error.message || 'Şifre değiştirilemedi');
    }
  };

  const updateProfilePhoto = async (photoURL: string): Promise<void> => {
    try {
      const authInstance = auth(getApp());
      const currentUser = authInstance.currentUser;
      if (!currentUser) {
        throw new Error('Kullanıcı giriş yapmamış');
      }

      await currentUser.updateProfile({
        photoURL: photoURL,
      });

      // State'i güncelle
      setUser({
        uid: currentUser.uid,
        email: currentUser.email,
        displayName: currentUser.displayName,
        photoURL: photoURL,
      });
    } catch (error: any) {
      throw new Error(error.message || 'Profil fotoğrafı güncellenemedi');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signIn,
        signUp,
        signOut,
        resetPassword,
        updateProfile,
        changePassword,
        updateProfilePhoto,
      }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

