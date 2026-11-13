import { useTheme, type ThemeColors } from '../../src/context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const SLIDES = [
  {
    id: 1,
    title: "Encuentra Expertos",
    description: "Localiza técnicos verificados cerca de tu ubicación en tiempo real.",
    icon: "map",
    color: "#0369A1"
  },
  {
    id: 2,
    title: "Seguridad Garantizada",
    description: "Todos los servicios se cierran con evidencia fotográfica.",
    icon: "shield-checkmark",
    color: "#166534"
  },
  {
    id: 3,
    title: "Comunicación Directa",
    description: "Chatea con tu proveedor sin compartir tu número personal.",
    icon: "chatbubbles",
    color: "#5B21B6"
  }
];

export default function OnboardingScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const [currentSlide, setCurrentSlide] = useState(0);

  const handleNext = () => {
    if (currentSlide < SLIDES.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      router.replace('/auth/login');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.slideContainer}>
        <View style={[styles.iconContainer, { backgroundColor: SLIDES[currentSlide].color }]}>
            <Ionicons name={SLIDES[currentSlide].icon as any} size={80} color="#fff" />
        </View>
        <Text style={styles.title} numberOfLines={2}>{SLIDES[currentSlide].title}</Text>
        <Text style={styles.description}>{SLIDES[currentSlide].description}</Text>
      </View>

      {/* Puntos indicadores */}
      <View style={styles.dotsContainer}>
        {SLIDES.map((_, index) => (
          <View key={index} style={[styles.dot, currentSlide === index && styles.activeDot]} />
        ))}
      </View>

      {/* Botón */}
      <TouchableOpacity style={styles.button} onPress={handleNext}>
        <Text style={styles.buttonText}>
            {currentSlide === SLIDES.length - 1 ? "COMENZAR" : "SIGUIENTE"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.card, justifyContent: 'space-between', paddingVertical: 50 },
  slideContainer: { alignItems: 'center', paddingHorizontal: 40, marginTop: 50 },
  iconContainer: { width: 150, height: 150, borderRadius: 75, justifyContent: 'center', alignItems: 'center', marginBottom: 40, elevation: 10 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#333', textAlign: 'center', marginBottom: 15 },
  description: { fontSize: 16, color: '#666', textAlign: 'center', lineHeight: 24 },
  dotsContainer: { flexDirection: 'row', justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#ddd', marginHorizontal: 5 },
  activeDot: { backgroundColor: '#007bff', width: 20 },
  button: { backgroundColor: '#007bff', marginHorizontal: 40, padding: 18, borderRadius: 15, alignItems: 'center', marginBottom: 20 },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16, letterSpacing: 1 }
});