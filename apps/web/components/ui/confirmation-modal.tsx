'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Archive, Trash2, X, Loader2 } from 'lucide-react';
import { Button } from '@autodm/ui';

export interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary';
  loading?: boolean;
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  loading = false,
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (variant) {
      case 'warning':
        return (
          <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-600 shadow-2xs">
            <Archive className="h-6 w-6" />
          </div>
        );
      case 'danger':
        return (
          <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200/80 text-rose-600 shadow-2xs">
            <Trash2 className="h-6 w-6" />
          </div>
        );
      default:
        return (
          <div className="p-3 rounded-2xl bg-blue-50 border border-blue-200/80 text-blue-600 shadow-2xs">
            <AlertTriangle className="h-6 w-6" />
          </div>
        );
    }
  };

  const getButtonVariant = (): 'destructive' | 'warning' | 'success' => {
    switch (variant) {
      case 'warning':
        return 'warning';
      case 'danger':
        return 'destructive';
      default:
        return 'success';
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs cursor-pointer"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 10 }}
          transition={{ type: 'spring', duration: 0.25 }}
          className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl z-10 space-y-4 font-sans overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              {getIcon()}
              <div>
                <h3 className="text-base font-bold text-slate-900 leading-snug">{title}</h3>
                <span className="text-[11px] font-medium text-slate-400">
                  Confirmation Required
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={loading}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Description */}
          <p className="text-xs text-slate-600 leading-relaxed pt-1">{description}</p>

          {/* Actions */}
          <div className="flex justify-end items-center space-x-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={loading}
              className="text-xs font-semibold"
            >
              {cancelText}
            </Button>
            <Button
              type="button"
              variant={getButtonVariant()}
              size="sm"
              onClick={onConfirm}
              disabled={loading}
              className="text-xs font-semibold"
            >
              {loading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  Processing...
                </>
              ) : (
                confirmText
              )}
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
