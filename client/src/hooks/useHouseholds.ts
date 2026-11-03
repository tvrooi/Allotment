import { useQuery } from '@tanstack/react-query';
import { getHouseholds } from '../api/households';

/** The budget's households (shared with every ['households'] query) */
export const useHouseholds = () => useQuery({ queryKey: ['households'], queryFn: getHouseholds });
