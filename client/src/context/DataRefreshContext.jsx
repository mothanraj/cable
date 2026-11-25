import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

const DataRefreshContext = createContext(null);

export function DataRefreshProvider({ children }) {
  const [version, setVersion] = useState(0);

  const notifyDataChanged = useCallback(() => {
    setVersion((current) => current + 1);
  }, []);

  const value = useMemo(
    () => ({ version, notifyDataChanged }),
    [version, notifyDataChanged]
  );

  return (
    <DataRefreshContext.Provider value={value}>
      {children}
    </DataRefreshContext.Provider>
  );
}

export function useDataRefresh() {
  return (
    useContext(DataRefreshContext) || {
      version: 0,
      notifyDataChanged: () => {},
    }
  );
}
