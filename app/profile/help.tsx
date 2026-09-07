import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../src/context/ThemeContext';

const FAQS = [
  { id: 1, question: '¿Cómo solicito un servicio?', answer: 'Ve al mapa, selecciona una categoría o busca un técnico cercano. Toca el marcador y presiona "Solicitar".' },
  { id: 2, question: '¿Es seguro el servicio?', answer: 'Sí. Todos nuestros técnicos pasan por un filtro de seguridad y cada servicio finaliza con evidencia fotográfica.' },
  { id: 3, question: '¿Cómo realizo el pago?', answer: 'El pago se acuerda directamente con el técnico (Yape, Plin o Efectivo) al finalizar el servicio.' },
  { id: 4, question: '¿Puedo cancelar una solicitud?', answer: 'Sí, siempre y cuando el técnico no haya iniciado el viaje. Ve a tu servicio activo y selecciona cancelar.' },
];

export default function HelpScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [expandedId, setExpandedId] = useState<number | null>(null);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 5 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Ayuda y Soporte</Text>
      </View>

      <ScrollView style={styles.content}>
        <Text style={[styles.subtitle, { color: colors.primary }]}>Preguntas Frecuentes</Text>

        {FAQS.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.faqItem, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => setExpandedId(expandedId === item.id ? null : item.id)}
            activeOpacity={0.8}
          >
            <View style={styles.questionRow}>
              <Text style={[styles.question, { color: colors.text }]}>{item.question}</Text>
              <Ionicons
                name={expandedId === item.id ? "chevron-up" : "chevron-down"}
                size={20}
                color={colors.subtext}
              />
            </View>
            {expandedId === item.id && (
              <Text style={[styles.answer, { color: colors.subtext }]}>{item.answer}</Text>
            )}
          </TouchableOpacity>
        ))}

        <View style={[styles.contactCard, { backgroundColor: colors.input }]}>
          <Ionicons name="headset" size={40} color={colors.primary} />
          <Text style={[styles.contactTitle, { color: colors.text }]}>¿Necesitas más ayuda?</Text>
          <Text style={[styles.contactText, { color: colors.subtext }]}>Escríbenos a soporte@tesisapp.com</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, paddingTop: 50, borderBottomWidth: 1 },
  title: { fontSize: 20, fontWeight: 'bold', marginLeft: 15 },
  content: { padding: 20 },
  subtitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  faqItem: { borderRadius: 12, marginBottom: 10, borderWidth: 1, overflow: 'hidden' },
  questionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15 },
  question: { fontSize: 16, fontWeight: '600', flex: 1 },
  answer: { padding: 15, paddingTop: 0, fontSize: 14, lineHeight: 20 },
  contactCard: { alignItems: 'center', padding: 30, borderRadius: 20, marginTop: 20, marginBottom: 40 },
  contactTitle: { fontSize: 18, fontWeight: 'bold', marginTop: 10 },
  contactText: { marginTop: 5 }
});