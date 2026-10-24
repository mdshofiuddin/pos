import { useState, useCallback, ChangeEvent } from 'react';

export function useFormState<T extends Record<string, any>>(initialValues: T) {
  const [form, setForm] = useState<T>(initialValues);

  const handleChange = useCallback(
    (field: keyof T, value: any) => {
      setForm((prev) => ({
        ...prev,
        [field]: value,
      }));
    },
    []
  );

  const handleInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const { name, value, type } = e.target;
      setForm((prev) => ({
        ...prev,
        [name]: type === 'number' ? (value === '' ? '' : Number(value)) : value,
      }));
    },
    []
  );

  const resetForm = useCallback(() => {
    setForm(initialValues);
  }, [initialValues]);

  return {
    form,
    setForm,
    handleChange,
    handleInputChange,
    resetForm,
  };
}
