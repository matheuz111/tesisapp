import { useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { auth, db } from '../src/config/firebase';

export default function Index() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Escuchar el estado de autenticación de Firebase
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {

        try {
          const docRef = doc(db, 'users', user.uid);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const userData = docSnap.data();
            const role = userData.role;


            if (role === 'CLIENT') {
              router.replace('/client/home');
            } else if (role === 'PROVIDER') {
              router.replace('/provider/home');
            } else {
              // Rol desconocido
              router.replace('/auth/login');
            }
          } else {
            router.replace('/auth/login');
          }
        } catch (error) {
          console.error("Error verificando rol:", error);
          router.replace('/auth/login');
        }
      } else {

        router.replace('/auth/login');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Spinner mientras decide a dónde mandarte
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#007bff" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});