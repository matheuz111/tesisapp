import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  BaseColors,
  BaseElevation,
  BaseRadii,
  BaseTypography,
  BaseHeader,
  BaseCard,
  BaseButton,
} from '../../src/components/base';

const FAQS = [
  {
    id: 1,
    question: '¿Cómo solicito un servicio técnico?',
    answer:
      'Desde la pantalla de inicio como Cliente, selecciona la especialidad que necesitas (Electricidad, Gasfitería, Pintura o Cerrajería), describe el problema, ingresa tu dirección o usa el mapa interactivo y confirma la solicitud.',
  },
  {
    id: 2,
    question: '¿Qué es el código PIN de llegada?',
    answer:
      'Es un código de 4 dígitos generado aleatoriamente para tu seguridad. Cuando el técnico llegue a tu domicilio, te pedirá este código para que el sistema valide el arribo y autorice el inicio de la labor.',
  },
  {
    id: 3,
    question: '¿Cómo funciona la garantía de 30 días?',
    answer:
      'Todos los servicios culminados cuentan con una cobertura de 30 días calendario respaldada por la central. Si experimentas cualquier problema dentro de este lapso, reporta el servicio desde tu historial para una reasignación sin costo adicional.',
  },
  {
    id: 4,
    question: '¿Cómo realizo el pago del servicio?',
    answer:
      'Puedes pagar directamente mediante Yape, Plin o efectivo una vez que el técnico haya subido la evidencia fotográfica y tú hayas aprobado la conformidad del trabajo en la aplicación.',
  },
  {
    id: 5,
    question: '¿Qué hago si no tengo conexión a internet en el momento?',
    answer:
      'La aplicación cuenta con soporte offline. Tanto la validación de estados como la subida de fotos se encolan de forma segura y se sincronizan automáticamente tan pronto recuperes la señal.',
  },
];

export default function HelpScreen() {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<number | null>(null);

  return (
    <View style={styles.container}>
      <BaseHeader
        title="Ayuda y Soporte"
        subtitle="Centro de preguntas frecuentes y asistencia"
        showBack
        onBack={() => router.back()}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>Preguntas Frecuentes</Text>

        {FAQS.map((item) => {
          const isExpanded = expandedId === item.id;
          return (
            <BaseCard
              key={item.id}
              variant="elevated"
              elevation="sm"
              style={styles.faqCard}
              onPress={() => setExpandedId(isExpanded ? null : item.id)}
            >
              <View style={styles.questionRow}>
                <Text style={styles.questionText}>{item.question}</Text>
                <Ionicons
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={BaseColors.gray500}
                />
              </View>

              {isExpanded && (
                <View style={styles.answerContainer}>
                  <Text style={styles.answerText}>{item.answer}</Text>
                </View>
              )}
            </BaseCard>
          );
        })}

        {/* Contact Support Box */}
        <BaseCard variant="filled" style={styles.contactCard}>
          <View style={styles.contactIconWrap}>
            <Ionicons name="headset" size={28} color={BaseColors.accent} />
          </View>
          <Text style={styles.contactTitle}>¿Necesitas soporte operativo?</Text>
          <Text style={styles.contactSubtitle}>
            La central de despacho y trazabilidad está disponible para coordinar y asistirte en cualquier momento.
          </Text>

          <BaseButton
            title="Contactar con Central de Despacho"
            icon="call-outline"
            variant="solid"
            intent="primary"
            size="md"
            onPress={() => router.back()}
            style={{ marginTop: 12 }}
          />
        </BaseCard>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BaseColors.gray50,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: BaseTypography.sizes.base,
    fontWeight: BaseTypography.weights.bold,
    color: BaseColors.gray900,
    marginBottom: 14,
  },
  faqCard: {
    marginBottom: 10,
    padding: 16,
  },
  questionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  questionText: {
    fontSize: BaseTypography.sizes.sm,
    fontWeight: BaseTypography.weights.bold,
    color: BaseColors.gray900,
    flex: 1,
    includeFontPadding: false,
  },
  answerContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: BaseColors.gray100,
  },
  answerText: {
    fontSize: BaseTypography.sizes.xs,
    color: BaseColors.gray600,
    lineHeight: 18,
  },
  contactCard: {
    alignItems: 'center',
    padding: 24,
    marginTop: 16,
    borderWidth: 1,
    borderColor: BaseColors.gray200,
  },
  contactIconWrap: {
    width: 52,
    height: 52,
    borderRadius: BaseRadii.lg,
    backgroundColor: BaseColors.accentLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  contactTitle: {
    fontSize: BaseTypography.sizes.base,
    fontWeight: BaseTypography.weights.bold,
    color: BaseColors.gray900,
    textAlign: 'center',
  },
  contactSubtitle: {
    fontSize: BaseTypography.sizes.xs,
    color: BaseColors.gray500,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
});
