import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { SemanticColors, TouchTarget } from '../theme/tokens';
import { AnimatedPressable } from './AnimatedPressable';
import { AnimatedFadeIn } from './AnimatedFadeIn';
import { MAX_REVIEW_COMMENT_LENGTH } from '../services/ratings';

/**
 * Cuestionario Oficial CSAT — Instrumento de Investigación (IBM SPSS)
 * Los 5 ítems Likert (1 a 5) son inmutables por especificación de tesis.
 */
export const CSAT_QUESTIONS = [
  {
    id: 1,
    title: 'Satisfacción General',
    question: 'En general, estoy satisfecho(a) con el servicio técnico recibido.',
  },
  {
    id: 2,
    title: 'Tiempo de Atención',
    question: 'El tiempo de atención de mi solicitud fue adecuado.',
  },
  {
    id: 3,
    title: 'Comunicación y Claridad',
    question: 'La comunicación sobre el estado de mi servicio fue clara y oportuna.',
  },
  {
    id: 4,
    title: 'Efectividad Técnica',
    question: 'El técnico asignado resolvió mi requerimiento de manera satisfactoria.',
  },
  {
    id: 5,
    title: 'Recomendación',
    question: 'Recomendaría los servicios de la empresa a otras personas.',
  },
] as const;

export const LIKERT_OPTIONS = [
  { value: 1, label: 'Muy en desacuerdo', sublabel: 'Totalmente insatisfecho', color: '#EF4444' },
  { value: 2, label: 'En desacuerdo', sublabel: 'Insatisfecho', color: '#F97316' },
  { value: 3, label: 'Neutral', sublabel: 'Ni satisfecho ni insatisfecho', color: '#FBBF24' },
  { value: 4, label: 'De acuerdo', sublabel: 'Satisfecho', color: '#84CC16' },
  { value: 5, label: 'Muy de acuerdo', sublabel: 'Totalmente satisfecho', color: '#16A34A' },
] as const;

interface Props {
  visible: boolean;
  onClose: () => void;
  onSubmit: (answers: Record<number, number>, comment: string, overallRating: number) => Promise<void>;
  loading?: boolean;
}

export function CsatSurveyModal({ visible, onClose, onSubmit, loading = false }: Props) {
  // Pasos: 0 a 4 = preguntas Likert 1 a 5; paso 5 = reseña opcional final
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);

  const totalSteps = CSAT_QUESTIONS.length;
  const isFinalStep = currentStep === totalSteps;
  const currentQuestion = CSAT_QUESTIONS[currentStep];
  const selectedScore = currentQuestion ? answers[currentQuestion.id] : null;

  const handleSelectScore = (value: number) => {
    if (loading) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: value,
    }));
    setError(null);
  };

  const handleNext = () => {
    if (!isFinalStep && !selectedScore) {
      setError('Por favor selecciona una opción antes de continuar.');
      return;
    }
    setError(null);
    setCurrentStep((prev) => Math.min(prev + 1, totalSteps));
  };

  const handleBack = () => {
    setError(null);
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const handleSubmit = async () => {
    // Validar que las 5 respuestas estén presentes
    for (const q of CSAT_QUESTIONS) {
      if (!answers[q.id]) {
        setError(`Falta responder la pregunta ${q.id}: ${q.title}`);
        setCurrentStep(q.id - 1);
        return;
      }
    }

    // Calcular promedio general redondeado (1 a 5)
    const sum = Object.values(answers).reduce((acc, v) => acc + v, 0);
    const overallRating = Math.max(1, Math.min(5, Math.round(sum / totalSteps)));

    try {
      await onSubmit(answers, comment.trim(), overallRating);
      // Reset
      setCurrentStep(0);
      setAnswers({});
      setComment('');
    } catch (err: any) {
      setError(err?.message || 'No se pudo guardar la evaluación.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          {/* Cabecera */}
          <View style={styles.header}>
            <View style={styles.headerIconWrap}>
              <Ionicons name="star" size={22} color={SemanticColors.primary.main} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Evaluación de Calidad CSAT</Text>
              <Text style={styles.subtitle}>
                Tu retroalimentación impulsa la mejora continua de nuestro equipo técnico
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} disabled={loading} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Barra de Progreso e Indicador */}
          <View style={styles.progressContainer}>
            <View style={styles.progressLabelRow}>
              <Text style={styles.stepIndicatorText}>
                {isFinalStep
                  ? 'Comentarios Finales (Opcional)'
                  : `Pregunta ${currentStep + 1} de ${totalSteps}`}
              </Text>
              <Text style={styles.percentText}>
                {Math.round(((currentStep + (isFinalStep ? 1 : 0)) / (totalSteps + 1)) * 100)}%
              </Text>
            </View>
            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${((currentStep + (isFinalStep ? 1 : 0)) / (totalSteps + 1)) * 100}%` },
                ]}
              />
            </View>
          </View>

          {error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color="#991B1B" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Contenido Dinámico: Pregunta Likert vs. Comentario Final */}
          {!isFinalStep && currentQuestion ? (
            <ScrollView style={styles.scrollBody} showsVerticalScrollIndicator={false}>
              <AnimatedFadeIn key={currentQuestion.id} duration={200} translateDistance={6}>
                <View style={styles.questionCard}>
                <Text style={styles.questionCategory}>{currentQuestion.title.toUpperCase()}</Text>
                <Text style={styles.questionText}>&ldquo;{currentQuestion.question}&rdquo;</Text>
              </View>

              <Text style={styles.likertPrompt}>Selecciona tu grado de acuerdo (1 a 5):</Text>

              {/* Opciones Likert 1 a 5 */}
              <View style={styles.likertList}>
                {LIKERT_OPTIONS.map((opt) => {
                  const isSelected = selectedScore === opt.value;
                  return (
                    <AnimatedPressable
                      scaleTo={0.98}
                      hapticFeedback="light"
                      key={opt.value}
                      disabled={loading}
                      onPress={() => handleSelectScore(opt.value)}
                      style={[
                        styles.likertOption,
                        isSelected && {
                          borderColor: SemanticColors.primary.main,
                          backgroundColor: '#F0F9FF',
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.scoreCircle,
                          {
                            borderColor: isSelected ? SemanticColors.primary.main : '#CBD5E1',
                            backgroundColor: isSelected ? SemanticColors.primary.main : '#F8FAFC',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.scoreNumber,
                            { color: isSelected ? '#FFFFFF' : '#334155' },
                          ]}
                        >
                          {opt.value}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.optionLabel,
                            { color: isSelected ? SemanticColors.primary.main : '#0F172A' },
                          ]}
                        >
                          {opt.label}
                        </Text>
                        <Text style={styles.optionSublabel}>{opt.sublabel}</Text>
                      </View>
                      {isSelected && (
                        <Ionicons
                          name="checkmark-circle"
                          size={22}
                          color={SemanticColors.primary.main}
                        />
                      )}
                    </AnimatedPressable>
                  );
                })}
              </View>
              </AnimatedFadeIn>
            </ScrollView>
          ) : (
            /* Paso Final: Reseña Opcional */
            <ScrollView style={styles.scrollBody} showsVerticalScrollIndicator={false}>
              <AnimatedFadeIn key="final-step" duration={200} translateDistance={6}>
              <View style={styles.summaryBox}>
                <Ionicons name="chatbubbles-outline" size={28} color={SemanticColors.primary.main} />
                <Text style={styles.summaryTitle}>¿Deseas agregar algún comentario o sugerencia?</Text>
                <Text style={styles.summaryDesc}>
                  Tu opinión nos ayuda a reconocer al personal destacado o a corregir oportunamente cualquier detalle del servicio.
                </Text>
              </View>

              <TextInput
                style={styles.commentInput}
                placeholder="Escribe tu reseña o comentario para el técnico y la empresa (opcional)..."
                placeholderTextColor="#94A3B8"
                multiline
                maxLength={MAX_REVIEW_COMMENT_LENGTH}
                value={comment}
                onChangeText={setComment}
                editable={!loading}
              />
              <Text style={styles.charCount}>
                {comment.length} / {MAX_REVIEW_COMMENT_LENGTH} caracteres
              </Text>
              </AnimatedFadeIn>
            </ScrollView>
          )}

          {/* Navegación y Acciones */}
          <View style={styles.footerRow}>
            {currentStep > 0 && (
              <TouchableOpacity
                style={[styles.btn, styles.btnBack]}
                onPress={handleBack}
                disabled={loading}
              >
                <Ionicons name="arrow-back" size={18} color="#334155" />
                <Text style={styles.btnBackText}>Anterior</Text>
              </TouchableOpacity>
            )}

            {!isFinalStep ? (
              <TouchableOpacity
                style={[
                  styles.btn,
                  styles.btnPrimary,
                  { opacity: !selectedScore || loading ? 0.6 : 1 },
                ]}
                onPress={handleNext}
                disabled={!selectedScore || loading}
              >
                <Text style={styles.btnPrimaryText}>Siguiente</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary, { backgroundColor: '#166534' }]}
                onPress={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Ionicons name="checkmark-done" size={20} color="#FFFFFF" />
                    <Text style={styles.btnPrimaryText}>Finalizar y Enviar</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  headerIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
    lineHeight: 16,
  },
  closeBtn: {
    padding: 4,
  },
  progressContainer: {
    marginBottom: 14,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  stepIndicatorText: {
    fontSize: 12,
    fontWeight: '800',
    color: SemanticColors.primary.main,
    letterSpacing: 0.4,
  },
  percentText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: SemanticColors.primary.main,
    borderRadius: 3,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEE2E2',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  errorText: {
    color: '#991B1B',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  scrollBody: {
    maxHeight: 380,
  },
  questionCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 14,
  },
  questionCategory: {
    fontSize: 11,
    fontWeight: '900',
    color: SemanticColors.primary.main,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  questionText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 22,
  },
  likertPrompt: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
  },
  likertList: {
    gap: 8,
    marginBottom: 10,
  },
  likertOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    minHeight: TouchTarget.mobileMin,
  },
  scoreCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  scoreNumber: {
    fontSize: 14,
    fontWeight: '800',
  },
  optionLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  optionSublabel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  summaryBox: {
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0369A1',
    marginTop: 8,
    textAlign: 'center',
  },
  summaryDesc: {
    fontSize: 12,
    color: '#0C4A6E',
    marginTop: 4,
    textAlign: 'center',
    lineHeight: 17,
  },
  commentInput: {
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
    minHeight: 90,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'right',
    marginTop: 4,
    marginBottom: 8,
  },
  footerRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  btn: {
    flex: 1,
    minHeight: TouchTarget.mobileMin,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
  },
  btnBack: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  btnBackText: {
    color: '#334155',
    fontWeight: '700',
    fontSize: 14,
  },
  btnPrimary: {
    backgroundColor: SemanticColors.primary.main,
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
});
