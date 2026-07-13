import React, { useState, useEffect, useRef } from 'react';

type ColorInputProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  title?: string;
};

export const ColorInput: React.FC<ColorInputProps> = ({ value, onChange, className, title }) => {
  const [localColor, setLocalColor] = useState(value);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    setLocalColor(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalColor(val);
    
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onChange(val);
    }, 120); // 120ms debounce is optimal for drag-smoothness and low lag
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <input
      type="color"
      value={localColor}
      onChange={handleChange}
      className={className}
      title={title}
    />
  );
};
