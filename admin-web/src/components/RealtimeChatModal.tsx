import { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import type { ServiceRequest, ChatMessage } from '../types';
import { X, Send, MessageSquare, Image as ImageIcon, CheckCheck, Loader2 } from 'lucide-react';
import { ImageLightboxModal } from './ImageLightboxModal';

interface Props {
  request: ServiceRequest | null;
  onClose: () => void;
}

export const RealtimeChatModal = ({ request, onClose }: Props) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [inspectingImage, setInspectingImage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

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
    setLoading(true);

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

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
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
    }
  };

  const formatMessageTime = (createdAt: any) => {
    if (!createdAt) return '';
    const date = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  };

  if (!request) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card chat-modal" onClick={(e) => e.stopPropagation()}>
        {/* Encabezado Minimalista del Chat */}
        <div className="chat-modal-header">
          <div className="chat-header-info">
            <div className="chat-header-top">
              <span className="badge badge-code">{request.code || request.id.slice(0, 8)}</span>
              <div className="chat-live-pulse">
                <span className="pulse-dot" />
                <span className="pulse-text">En Vivo · Tiempo Real</span>
              </div>
            </div>

            <div className="chat-participants-row">
              <div className="participant-chip client">
                <span className="chip-role">Cliente:</span>
                <span className="chip-name">{request.clientName || 'Cliente'}</span>
                {request.clientPhone && <span className="chip-phone">({request.clientPhone})</span>}
              </div>

              <span className="participants-divider">↔</span>

              <div className="participant-chip worker">
                <span className="chip-role">Técnico:</span>
                <span className="chip-name">{request.providerName || 'Sin técnico asignado'}</span>
                {request.providerPhone && <span className="chip-phone">({request.providerPhone})</span>}
              </div>
            </div>
          </div>

          <button type="button" className="btn-close" onClick={onClose} title="Cerrar chat (Esc)">
            <X size={18} />
          </button>
        </div>

        {/* Cuerpo de la Conversación */}
        <div className="chat-messages-container">
          {loading ? (
            <div className="chat-empty-state">
              <Loader2 size={24} className="spinner" />
              <span>Cargando conversación en tiempo real...</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="chat-empty-state">
              <MessageSquare size={32} strokeWidth={1.5} />
              <p className="empty-title">Aún no hay mensajes en esta solicitud</p>
              <span className="empty-sub">
                Los mensajes entre el cliente y el trabajador aparecerán aquí al instante.
              </span>
            </div>
          ) : (
            messages.map((msg) => {
              const isProvider = msg.senderId === request.providerId || msg.senderRole === 'PROVIDER';
              const isOperator = msg.senderRole === 'OPERATOR';

              let bubbleClass = 'chat-bubble client-bubble';
              let senderLabel = request.clientName || 'Cliente';
              let roleBadgeClass = 'role-badge-client';

              if (isProvider) {
                bubbleClass = 'chat-bubble worker-bubble';
                senderLabel = request.providerName || 'Técnico';
                roleBadgeClass = 'role-badge-worker';
              } else if (isOperator) {
                bubbleClass = 'chat-bubble operator-bubble';
                senderLabel = msg.senderName || 'Central de Operaciones';
                roleBadgeClass = 'role-badge-operator';
              }

              return (
                <div key={msg.id} className={`chat-row ${isProvider ? 'row-right' : isOperator ? 'row-center' : 'row-left'}`}>
                  <div className={bubbleClass}>
                    <div className="bubble-header">
                      <span className={`bubble-role-badge ${roleBadgeClass}`}>{senderLabel}</span>
                      <span className="bubble-time">{formatMessageTime(msg.createdAt)}</span>
                    </div>

                    {msg.type === 'image' && msg.mediaUrl ? (
                      <div className="chat-img-wrap" onClick={() => setInspectingImage(msg.mediaUrl!)}>
                        <img src={msg.mediaUrl} alt="Adjunto" className="chat-msg-img" />
                        <span className="chat-img-hint"><ImageIcon size={12} /> Clic para ampliar</span>
                      </div>
                    ) : null}

                    {msg.text ? <p className="bubble-text">{msg.text}</p> : null}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Barra de Envío Minimalista (Intervención de la Central) */}
        <form className="chat-input-bar" onSubmit={handleSendMessage}>
          <input
            type="text"
            className="chat-input-field"
            placeholder="Enviar mensaje o aviso como Central de Operaciones..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={sending}
          />
          <button
            type="submit"
            className="btn-chat-send"
            disabled={!inputText.trim() || sending}
            title="Enviar mensaje"
          >
            {sending ? <Loader2 size={16} className="spinner" /> : <Send size={16} />}
          </button>
        </form>

        <div className="chat-footer-note">
          <CheckCheck size={13} />
          <span>Sincronización segura punto a punto · Visible para Cliente, Técnico y Operadores</span>
        </div>
      </div>

      {/* Visor de imágenes del chat */}
      {inspectingImage && (
        <ImageLightboxModal
          imageUrl={inspectingImage}
          title={`Adjunto de Chat (${request.code || 'SOLICITUD'})`}
          onClose={() => setInspectingImage(null)}
        />
      )}
    </div>
  );
};
