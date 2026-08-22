import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { RoutePaths } from '@/config';

export function CollectablesHub() {
  const navigate = useNavigate();
  useEffect(() => { navigate(RoutePaths.Home, { replace: true }); }, []);
  return null;
}