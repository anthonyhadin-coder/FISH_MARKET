import { useState, useEffect, useCallback, useRef } from 'react';

interface FieldError {
  field: string;
  message: string;
}

export function useFormErrors() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const handleErrors = (e: Event) => {
      const customEvent = e as CustomEvent<FieldError[]>;
      const newErrors: Record<string, string> = {};
      
      customEvent.detail.forEach(err => {
        newErrors[err.field] = err.message;
      });
      
      setErrors(newErrors);

      // Scroll to and focus the first invalid field automatically
      if (customEvent.detail.length > 0 && formRef.current) {
        const firstField = customEvent.detail[0].field;
        // Try to find the input by name or id
        const inputElement = formRef.current.querySelector(
          `[name="${firstField}"], #${firstField}`
        ) as HTMLElement;
        
        if (inputElement) {
          inputElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          inputElement.focus();
        }
      }
    };

    window.addEventListener('api:form-errors', handleErrors);
    return () => window.removeEventListener('api:form-errors', handleErrors);
  }, []);

  const clearError = useCallback((field: string) => {
    setErrors(prev => {
      if (!prev[field]) return prev;
      const copy = { ...prev };
      delete copy[field];
      return copy;
    });
  }, []);

  const clearAllErrors = useCallback(() => {
    setErrors({});
  }, []);

  // Generic props to spread on inputs
  const getInputProps = (name: string) => {
    const errorMsg = errors[name];
    const hasError = !!errorMsg;
    return {
      name,
      id: name,
      'aria-invalid': hasError,
      'aria-describedby': hasError ? `${name}-error` : undefined,
      onChange: () => {
        if (hasError) clearError(name);
      },
    };
  };

  return { errors, clearError, clearAllErrors, formRef, getInputProps };
}
