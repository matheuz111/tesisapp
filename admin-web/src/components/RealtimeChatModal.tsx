import { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import type { ServiceRequest, ChatMessage } from '../types';
import {
  X,
  Send,
  MessageSquare,
  Image as ImageIcon,
  CheckCheck,
  Loader2,
  User,
  Wrench,
  Headphones,
  Phone,
  Sparkles,
  Copy,
  Check,
  ShieldCheck,
} from 'lucide-react';
import { ImageLightboxModal } from './ImageLightboxModal';

interface Props {
  request: ServiceRequest | null;
  onClose: () => void;
}

const QUICK_ACTIONS = [
  { label: '🔑 Solicitar código', text: 'Central de Operaciones: Estimado cliente, por favor tenga listo su código de conformidad de 4 dígitos para validar el servicio al finalizar.' },
  { label: '📍 Técnico en camino', text: 'Central de Operaciones: El técnico asignado se encuentra en camino al domicilio registrado.' },
  { label: '🛠️ Supervisión activa', text: 'Central de Operaciones: La Central se encuentra monitoreando la ejecución del servicio en tiempo real.' },
  { label: '✅ Cierre conforme', text: 'Central de Operaciones: El servicio ha sido validado y registrado en la central con conformidad total.' },
  { label: '📞 Contacto telefónico', text: 'Central de Operaciones: Se coordinó telefónicamente con el cliente para el ingreso al inmueble.' },
];

export const RealtimeChatModal = ({ request, onClose }: Props) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [inspectingImage, setInspectingImage] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Escuchar tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Escuchar mensajes en tiempo real
  useEffect(() => {
    if (!request?.id) return;

    const messagesRef = collection(db, 'service_requests', request.id, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: ChatMessage[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as ChatMessage[];
        setMessages(items);
        setLoading(false);
      },
      (err) => {
        console.warn('Error al cargar mensajes del chat:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [request?.id]);

  // Auto-scroll al recibir o enviar mensajes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !request?.id || sending) return;

    setSending(true);
    const textToSend = inputText.trim();
    setInputText('');

    try {
      await addDoc(collection(db, 'service_requests', request.id, 'messages'), {
        text: textToSend,
        senderId: auth.currentUser?.uid || 'OPERATOR',
        senderRole: 'OPERATOR',
        senderName: 'Central de Operaciones',
        type: 'text',
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Error al enviar mensaje desde la central:', err);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleQuickAction = (text: string) => {
    setInputText(text);
    inputRef.current?.focus();
  };

  const handleCopyCode = (code: string) => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const formatMessageTime = (createdAt: any) => {
    if (!createdAt) return '';
    const date = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  };

  const getMessageDateLabel = (createdAt: any) => {
    if (!createdAt) return 'Hoy';
    const date = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
    if (isNaN(date.getTime())) return 'Hoy';
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return 'Hoy';
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return 'Ayer';
    return date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
  };

  if (!request) return null;

  const requestCode = request.code || request.id.slice(0, 8);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card chat-modal" onClick={(e) => e.stopPropagation()}>
        {/* Encabezado del Chat adaptado de Figma UI Kit (Top Bar) */}
        <div className="chat-modal-header">
          <div className="chat-header-top-row">
            <div className="chat-header-badges">
              <button
                type="button"
                className="badge-chat-code"
                onClick={() => handleCopyCode(requestCode)}
                title="Clic para copiar código de solicitud"
              >
                {requestCode}
                {copiedCode ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
              </button>

              <div className="chat-live-pulse">
                <span className="pulse-dot" />
                <span>En Vivo · Tiempo Real</span>
              </div>
            </div>

            <button
              type="button"
              className="btn-chat-close"
              onClick={onClose}
              title="Cerrar chat (Esc)"
              aria-label="Cerrar"
            >
              <X size={18} />
            </button>
          </div>

          {/* Participantes adaptado de Figma Top Section / Group */}
          <div className="chat-participants-row">
            <div className="participant-chip client">
              <span className="chip-avatar-mini">
                <User size={12} />
              </span>
              <span className="chip-role">Cliente:</span>
              <span className="chip-name">{request.clientName || 'Cliente'}</span>
              {request.clientPhone && (
                <a
                  href={`tel:${request.clientPhone}`}
                  className="chip-phone-link"
                  title="Llamar al cliente"
                >
                  <Phone size={10} />
                  <span>{request.clientPhone}</span>
                </a>
              )}
            </div>

            <span className="participants-divider">↔</span>

            <div className="participant-chip worker">
              <span className="chip-avatar-mini">
                <Wrench size={12} />
              </span>
              <span className="chip-role">Técnico:</span>
              <span className="chip-name">{request.providerName || 'Sin técnico asignado'}</span>
              {request.providerPhone && (
                <a
                  href={`tel:${request.providerPhone}`}
                  className="chip-phone-link"
                  title="Llamar al técnico"
                >
                  <Phone size={10} />
                  <span>{request.providerPhone}</span>
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Cuerpo de Mensajes adaptado del kit Text Chat Bubbles */}
        <div className="chat-messages-container">
          {loading ? (
            <div className="chat-empty-state">
              <Loader2 size={24} className="spinner" />
              <span>Cargando conversación en tiempo real...</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="chat-empty-state">
              <div className="empty-icon-wrap">
                <MessageSquare size={26} strokeWidth={1.8} />
              </div>
              <p className="empty-title">Sin mensajes registrados</p>
              <span className="empty-sub">
                Los mensajes entre el cliente, el técnico y la central aparecerán aquí al instante con sincronización segura.
              </span>
            </div>
          ) : (
            messages.map((msg, index) => {
              const isOperator = msg.senderRole === 'OPERATOR';
              const isProvider = !isOperator && (msg.senderId === request.providerId || msg.senderRole === 'PROVIDER');

              const prevMsg = index > 0 ? messages[index - 1] : null;
              const showDateSep =
                !prevMsg || getMessageDateLabel(prevMsg.createdAt) !== getMessageDateLabel(msg.createdAt);

              let senderLabel = request.clientName || msg.senderName || 'Cliente';
              if (isProvider) {
                senderLabel = request.providerName || msg.senderName || 'Técnico Asignado';
              } else if (isOperator) {
                senderLabel = 'Central de Operaciones (Tú)';
              }

              return (
                <div key={msg.id} className="chat-msg-group">
                  {showDateSep && (
                    <div className="chat-date-separator">
                      <span>{getMessageDateLabel(msg.createdAt)}</span>
                    </div>
                  )}

                  <div
                    className={`chat-row ${
                      isOperator ? 'row-operator' : isProvider ? 'row-worker' : 'row-client'
                    }`}
                  >
                    {/* Avatar en Incoming (Cliente o Técnico) */}
                    {!isOperator && (
                      <div
                        className={`chat-avatar ${isProvider ? 'avatar-worker' : 'avatar-client'}`}
                        title={senderLabel}
                      >
                        {isProvider ? <Wrench size={14} /> : <User size={14} />}
                      </div>
                    )}

                    {/* Burbuja con estilo Figma */}
                    <div
                      className={`chat-bubble ${
                        isOperator ? 'bubble-operator' : isProvider ? 'bubble-worker' : 'bubble-client'
                      }`}
                    >
                      <div className="bubble-header">
                        <span className="bubble-sender-name">{senderLabel}</span>
                        <span
                          className={`bubble-role-pill ${
                            isOperator ? 'role-operator' : isProvider ? 'role-worker' : 'role-client'
                          }`}
                        >
                          {isOperator ? 'Central' : isProvider ? 'Técnico' : 'Cliente'}
                        </span>
                      </div>

                      {msg.type === 'image' && msg.mediaUrl ? (
                        <div className="chat-img-wrap" onClick={() => setInspectingImage(msg.mediaUrl!)}>
                          <img src={msg.mediaUrl} alt="Adjunto de chat" className="chat-msg-img" />
                          <span className="chat-img-hint">
                            <ImageIcon size={12} /> Clic para ampliar
                          </span>
                        </div>
                      ) : null}

                      {msg.text ? <p className="bubble-text">{msg.text}</p> : null}

                      <div className="bubble-footer">
                        <span className="bubble-time">{formatMessageTime(msg.createdAt)}</span>
                        {isOperator && (
                          <span className="bubble-status-icon" title="Entregado a todos los participantes">
                            <CheckCheck size={13} />
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Avatar en Outgoing (Central de Operaciones) */}
                    {isOperator && (
                      <div className="chat-avatar avatar-operator" title="Central de Operaciones">
                        <Headphones size={14} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Barra de Acciones Rápidas para el Operador */}
        <div className="chat-quick-actions-bar">
          <span className="quick-action-title">
            <Sparkles size={12} /> Plantillas:
          </span>
          {QUICK_ACTIONS.map((action, i) => (
            <button
              key={i}
              type="button"
              className="btn-quick-pill"
              onClick={() => handleQuickAction(action.text)}
              title="Insertar aviso predefinido en el campo de texto"
            >
              {action.label}
            </button>
          ))}
        </div>

        {/* Barra de Envío (Bottom Bar de Figma) */}
        <form className="chat-input-bar" onSubmit={handleSendMessage}>
          <input
            ref={inputRef}
            type="text"
            className="chat-input-field"
            placeholder="Escribir mensaje o aviso como Central de Operaciones..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={sending}
          />
          <button
            type="submit"
            className="btn-chat-send"
            disabled={!inputText.trim() || sending}
            title="Enviar mensaje (Enter)"
            aria-label="Enviar"
          >
            {sending ? <Loader2 size={16} className="spinner" /> : <Send size={16} />}
          </button>
        </form>

        {/* Nota de Seguridad y Trazabilidad */}
        <div className="chat-footer-note">
          <ShieldCheck size={13} />
          <span>Canal de Trazabilidad Oficial · Sincronización en tiempo real para Cliente, Técnico y Central</span>
        </div>
      </div>

      {/* Visor de imágenes del chat */}
      {inspectingImage && (
        <ImageLightboxModal
          imageUrl={inspectingImage}
          title={`Adjunto de Chat (${requestCode})`}
          onClose={() => setInspectingImage(null)}
        />
      )}
    </div>
  );
};
