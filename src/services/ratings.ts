import { doc, increment, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase';
import { withTimeout } from './async';

export const MAX_REVIEW_COMMENT_LENGTH = 300;

export function validateRating(rating: unknown): rating is number {
  return typeof rating === 'number' && Number.isInteger(rating) && rating >= 1 && rating <= 5;
}

export function sanitizeReviewComment(comment?: string | null): string | null {
  if (!comment) return null;
  const trimmed = comment.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_REVIEW_COMMENT_LENGTH);
}

export interface SubmitRatingParams {
  requestId: string;
  providerId?: string | null;
  rating: number;
  comment?: string | null;
}

export async function submitServiceRating({
  requestId,
  providerId,
  rating,
  comment,
}: SubmitRatingParams): Promise<void> {
  if (!requestId || typeof requestId !== 'string') {
    throw new Error('Identificador de servicio inválido.');
  }

  if (!validateRating(rating)) {
    throw new Error('La calificación debe ser un número entero entre 1 y 5 estrellas.');
  }

  const cleanComment = sanitizeReviewComment(comment);

  const batch = writeBatch(db);

  const requestRef = doc(db, 'service_requests', requestId);
  batch.update(requestRef, {
    rating_given: rating,
    review_comment: cleanComment,
    ratedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  if (providerId && typeof providerId === 'string' && providerId.trim()) {
    const providerRef = doc(db, 'users', providerId.trim());
    batch.update(providerRef, {
      total_rating: increment(rating),
      review_count: increment(1),
    });
  }

  await withTimeout(batch.commit(), 8000);
}
