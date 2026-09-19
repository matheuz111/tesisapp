export type ServiceStatus =
  | 'PENDING_ASSIGNMENT'
  | 'QUOTED'
  | 'REQUIRES_REASSIGNMENT'
  | 'PENDING'
  | 'ACCEPTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'VALIDATED'
  | 'CANCELLED_BY_CLIENT'
  | 'CANCELLED_BY_PROVIDER'
  | 'CANCELLED_BY_OPERATOR';

export const STATUS_LABELS: Record<string, string> = {
  PENDING_ASSIGNMENT: 'Pendiente de Asignación',
  REQUIRES_REASSIGNMENT: 'Requiere Reasignación',
  PENDING: 'Pendiente',
  ACCEPTED: 'Aceptado',
  IN_PROGRESS: 'En Progreso',
  COMPLETED: 'Completado',
  VALIDATED: 'Validado',
  QUOTED: 'Cotizado',
  CANCELLED_BY_CLIENT: 'Cancelado por Cliente',
  CANCELLED_BY_PROVIDER: 'Cancelado por Técnico',
  CANCELLED_BY_OPERATOR: 'Cancelado por Central',
};

export const formatStatus = (status?: string | null): string => {
  if (!status) return '—';
  return STATUS_LABELS[status] || status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase());
};

export interface ChatMessage {
  id: string;
  text?: string;
  senderId: string;
  senderRole?: 'CLIENT' | 'PROVIDER' | 'OPERATOR' | 'SYSTEM';
  senderName?: string;
  type?: 'text' | 'image';
  mediaUrl?: string;
  createdAt?: any;
}

export type IntakeChannel = 'APP' | 'WHATSAPP' | 'PHONE' | 'EMAIL';
export type RequestOrigin = 'CLIENT' | 'OPERATOR';
export type Priority = 'NORMAL' | 'HIGH';

export interface ServiceRequest {
  id: string;
  code?: string;
  intakeChannel?: IntakeChannel;
  origin?: RequestOrigin;
  status: ServiceStatus;
  clientId?: string;
  clientName?: string;
  clientPhone?: string;
  district?: string;
  address?: string;
  addressReference?: string;
  specialty?: string;
  serviceLabel?: string;
  description?: string;
  priority?: Priority;
  urgency?: 'NOW' | 'TODAY' | 'SCHEDULED' | string;
  preferredTime?: string;
  preferredDate?: string;
  technicalVisitFee?: number;
  price_agreed?: string;
  pricing?: {
    price: number;
    description?: string;
    setBy?: string;
    setAt?: any;
  };
  quoteAccepted?: boolean;
  quoteAcceptedAt?: any;
  quoteRejectedAt?: any;
  securityPin?: string;
  providerId?: string;
  providerName?: string;
  providerPhone?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  clientLocation?: {
    latitude: number;
    longitude: number;
  };
  issuePhoto?: string;
  evidencePhoto?: string;
  paymentStatus?: 'PENDING' | 'PAID' | 'CONFIRMED';
  voucher?: string;
  review_rating?: number;
  review_comment?: string;
  createdAt?: any;
  firstResponseAt?: any;
  assignedAt?: any;
  acceptedAt?: any;
  startedAt?: any;
  finishedAt?: any;
  validatedAt?: any;
  updatedAt?: any;
}

export interface ProviderUser {
  id: string;
  full_name?: string;
  name?: string;
  email?: string;
  phone?: string;
  photoUrl?: string;
  avatar?: string;
  role: 'PROVIDER';
  specialty?: string;
  specialties?: string[];
  is_active?: boolean;
  is_verified?: boolean;
  approval_status?: 'APPROVED' | 'PENDING' | 'REJECTED';
  total_rating?: number;
  review_count?: number;
  activeRequestId?: string | null;
  current_location?: {
    latitude: number;
    longitude: number;
  };
}

export interface StatusHistoryItem {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  actorId: string;
  actorRole: 'CLIENT' | 'OPERATOR' | 'PROVIDER' | 'SYSTEM';
  timestamp: any;
  notes?: string;
}

export interface SpssRow {
  COD_SOL: string;
  CANAL: string;
  ORIGEN: string;
  DISTRITO: string;
  SERVICIO: string;
  PRIORIDAD: string;
  REQ_VIS: string;
  TARIFA_VIS: number;
  COT_EMIT: number;
  COT_APROB: string;
  REG_CORR: number;
  DATOS_COMP: number;
  FECHA_CREA: string;
  FECHA_RESP: string;
  FECHA_ASIG: string;
  FECHA_INIC: string;
  FECHA_FIN: string;
  FECHA_CIER: string;
  T_RESP_MIN: number | string;
  T_ASIG_MIN: number | string;
  T_VIS_MIN: number | string;
  T_TOTAL_MIN: number | string;
  CAMBIOS_EST: number;
  TRAZ_COMP: number;
  EVID_INI: number;
  EVID_FIN: number;
}
