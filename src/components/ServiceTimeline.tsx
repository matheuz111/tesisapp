import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';

export interface ServiceTimelineProps {
  request: any;
}

interface TimelineItem {
  key: string;
  title: string;
  subtitle?: string;
  timestamp?: any;
  icon: keyof typeof Ionicons.glyphMap;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'PENDING' | 'REJECTED';
}

function formatTimestamp(ts: any): string {
  if (!ts) return '';
  const date = ts?.toDate ? ts.toDate() : ts instanceof Date ? ts : ts?.seconds ? new Date(ts.seconds * 1000) : null;
  if (!date) return '';
  return `${date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })} · ${date.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}`;
}

export function ServiceTimeline({ request }: ServiceTimelineProps) {
  const { colors } = useTheme();

  if (!request) return null;

  const items: TimelineItem[] = [];

  // 1. Creación
  items.push({
    key: 'created',
    title: 'Solicitud Recibida',
    subtitle: `Canal: ${request.intakeChannel === 'operador_manual' ? 'Central (Manual)' : 'App Cliente'} · ${request.clientName || 'Cliente'}`,
    timestamp: request.createdAt,
    icon: 'document-text-outline',
    status: 'COMPLETED',
  });

  // 2. Cotización
  const hasPrice = Boolean(request.pricing?.amountCents || request.price_agreed);
  if (hasPrice || request.status === 'QUOTED') {
    items.push({
      key: 'quoted',
      title: 'Tarifa Cotizada por Central',
      subtitle: `${request.price_agreed || 'Tarifa fijada'} · ${request.pricing?.description || 'Visita técnica y diagnóstico'}`,
      timestamp: request.pricing?.updatedAt || request.quotedAt,
      icon: 'cash-outline',
      status: 'COMPLETED',
    });
  } else {
    items.push({
      key: 'quoted',
      title: 'Cotización de Tarifa',
      subtitle: 'Pendiente de cálculo por el operador',
      icon: 'cash-outline',
      status: request.status === 'PENDING_ASSIGNMENT' ? 'IN_PROGRESS' : 'PENDING',
    });
  }

  // 3. Aprobación de Cotización
  if (request.quoteAcceptedAt) {
    items.push({
      key: 'quote_accepted',
      title: 'Cotización Aceptada',
      subtitle: 'El cliente aprobó la tarifa y alcance',
      timestamp: request.quoteAcceptedAt,
      icon: 'checkmark-circle-outline',
      status: 'COMPLETED',
    });
  } else if (request.quoteRejectedAt || (request.status === 'CANCELLED_BY_CLIENT' && request.cancelReason === 'QUOTE_REJECTED')) {
    items.push({
      key: 'quote_rejected',
      title: 'Cotización Rechazada',
      subtitle: 'El cliente no aceptó la cotización',
      timestamp: request.quoteRejectedAt || request.cancelledAt,
      icon: 'close-circle-outline',
      status: 'REJECTED',
    });
  } else if (request.status === 'QUOTED') {
    items.push({
      key: 'quote_waiting',
      title: 'Aprobación de Cotización',
      subtitle: 'Esperando respuesta del cliente',
      icon: 'time-outline',
      status: 'IN_PROGRESS',
    });
  }

  // 4. Asignación de Técnico
  if (request.providerId) {
    items.push({
      key: 'assigned',
      title: 'Técnico Asignado',
      subtitle: `${request.providerName || 'Técnico seleccionado'} asignado por la central`,
      timestamp: request.assignedAt,
      icon: 'person-add-outline',
      status: 'COMPLETED',
    });
  } else {
    items.push({
      key: 'assigned',
      title: 'Asignación de Técnico',
      subtitle: 'Esperando selección por operador',
      icon: 'person-outline',
      status: ['PENDING_ASSIGNMENT', 'REQUIRES_REASSIGNMENT'].includes(request.status) ? 'IN_PROGRESS' : 'PENDING',
    });
  }

  // 5. Aceptación del Técnico
  if (request.acceptedAt || ['ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED'].includes(request.status)) {
    items.push({
      key: 'accepted',
      title: 'Técnico en Camino',
      subtitle: `${request.providerName || 'Técnico'} confirmó servicio y va a destino`,
      timestamp: request.acceptedAt,
      icon: 'car-outline',
      status: 'COMPLETED',
    });
  } else if (request.status === 'PENDING') {
    items.push({
      key: 'accepted',
      title: 'Confirmación del Técnico',
      subtitle: 'Notificación enviada al dispositivo del técnico',
      icon: 'car-outline',
      status: 'IN_PROGRESS',
    });
  }

  // 6. Validación de PIN e Inicio Presencial
  if (request.startedAt || request.serviceStarted) {
    items.push({
      key: 'pin_validated',
      title: 'Inicio Presencial (PIN Validado)',
      subtitle: `PIN confirmado · Servicio en ejecución formal`,
      timestamp: request.startedAt,
      icon: 'key-outline',
      status: 'COMPLETED',
    });
  } else if (request.status === 'ACCEPTED') {
    items.push({
      key: 'pin_validated',
      title: 'Validación de PIN de Seguridad',
      subtitle: 'Técnico debe ingresar el PIN del cliente al llegar',
      icon: 'key-outline',
      status: 'IN_PROGRESS',
    });
  }

  // 7. Culminación con Evidencia
  if (request.finished_at || ['COMPLETED', 'ARCHIVED'].includes(request.status)) {
    items.push({
      key: 'completed',
      title: 'Trabajo Culminado',
      subtitle: request.evidence_photo ? 'Evidencia fotográfica de cierre registrada' : 'Marcado como completado',
      timestamp: request.finished_at,
      icon: 'camera-outline',
      status: 'COMPLETED',
    });
  } else if (request.status === 'IN_PROGRESS') {
    items.push({
      key: 'completed',
      title: 'Ejecución del Servicio',
      subtitle: 'El técnico se encuentra ejecutando el trabajo',
      icon: 'construct-outline',
      status: 'IN_PROGRESS',
    });
  }

  // 8. Pago y Cobro
  if (request.paymentStatus === 'CONFIRMED') {
    items.push({
      key: 'payment',
      title: 'Pago Confirmado',
      subtitle: `Cobro recibido (${request.paymentMethod || 'DIGITAL'}) verificado por técnico`,
      timestamp: request.paymentConfirmedAt || request.updatedAt,
      icon: 'card-outline',
      status: 'COMPLETED',
    });
  } else if (request.paymentStatus === 'PAID') {
    items.push({
      key: 'payment',
      title: 'Comprobante de Pago Enviado',
      subtitle: `Cliente reportó pago (${request.paymentMethod || 'DIGITAL'})`,
      timestamp: request.paymentSubmittedAt,
      icon: 'receipt-outline',
      status: 'IN_PROGRESS',
    });
  }

  // 9. Validación y Cierre Central
  if (request.status === 'ARCHIVED') {
    items.push({
      key: 'validated',
      title: 'Servicio Validado y Cerrado',
      subtitle: 'La central auditó la evidencia y liquidó la orden',
      timestamp: request.validatedAt,
      icon: 'shield-checkmark-outline',
      status: 'COMPLETED',
    });
  } else if (request.status === 'COMPLETED') {
    items.push({
      key: 'validated',
      title: 'Validación Final de Evidencia',
      subtitle: 'Pendiente de aprobación por operador de la central',
      icon: 'shield-outline',
      status: 'IN_PROGRESS',
    });
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.headerTitle, { color: colors.text }]}>Línea de Tiempo y Trazabilidad</Text>
      <Text style={[styles.headerSubtitle, { color: colors.subtext }]}>
        Historial ordenado de eventos y auditoría del servicio
      </Text>

      <View style={styles.timelineList}>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const statusColor =
            item.status === 'COMPLETED'
              ? colors.success
              : item.status === 'IN_PROGRESS'
              ? colors.primary
              : item.status === 'REJECTED'
              ? colors.danger
              : colors.border;

          return (
            <View key={item.key} style={styles.row}>
              {/* Columna del nodo e hilera vertical */}
              <View style={styles.nodeColumn}>
                <View style={[styles.iconCircle, { backgroundColor: `${statusColor}18`, borderColor: statusColor }]}>
                  <Ionicons name={item.icon} size={16} color={statusColor} />
                </View>
                {!isLast && <View style={[styles.verticalLine, { backgroundColor: `${statusColor}40` }]} />}
              </View>

              {/* Contenido del hito */}
              <View style={[styles.contentColumn, !isLast && { paddingBottom: 18 }]}>
                <View style={styles.titleRow}>
                  <Text style={[styles.itemTitle, { color: colors.text }]}>{item.title}</Text>
                  {item.timestamp ? (
                    <Text style={[styles.timestamp, { color: colors.subtext }]}>
                      {formatTimestamp(item.timestamp)}
                    </Text>
                  ) : null}
                </View>
                {item.subtitle ? (
                  <Text style={[styles.itemSubtitle, { color: colors.subtext }]}>{item.subtitle}</Text>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginTop: 14,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 12,
    marginBottom: 16,
  },
  timelineList: {
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
  },
  nodeColumn: {
    alignItems: 'center',
    width: 32,
    marginRight: 10,
  },
  iconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  verticalLine: {
    width: 2,
    flex: 1,
    marginVertical: 2,
  },
  contentColumn: {
    flex: 1,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  timestamp: {
    fontSize: 11,
    fontWeight: '600',
  },
  itemSubtitle: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
});
