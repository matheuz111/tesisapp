import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      {/* Título o Logo */}
      <Text style={styles.title}>ServiHogar Tesis</Text>
      <Text style={styles.subtitle}>Conecta con expertos o trabaja con nosotros</Text>

      {/* Botón Opción A: Cliente */}
      <TouchableOpacity 
        style={[styles.card, styles.clientCard]}
        onPress={() => router.push('/auth/login?role=client')}
      >
        <Text style={styles.cardTitle}>Soy Cliente</Text>
        <Text style={styles.cardText}>Busco un servicio</Text>
      </TouchableOpacity>

      {/* Botón Opción B: Proveedor */}
      <TouchableOpacity 
        style={[styles.card, styles.providerCard]}
        onPress={() => router.push('/auth/login?role=provider')}
      >
        <Text style={styles.cardTitle}>Soy Proveedor</Text>
        <Text style={styles.cardText}>Quiero ofrecer mis servicios</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 40,
    color: '#666',
  },
  card: {
    padding: 20,
    borderRadius: 15,
    marginBottom: 20,
    elevation: 3, // Sombra en Android
    shadowColor: '#000', // Sombra en iOS
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  clientCard: {
    backgroundColor: '#ffffff',
    borderLeftWidth: 5,
    borderLeftColor: '#2196F3', // Azul
  },
  providerCard: {
    backgroundColor: '#ffffff',
    borderLeftWidth: 5,
    borderLeftColor: '#FF9800', // Naranja
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  cardText: {
    color: '#555',
  },
});