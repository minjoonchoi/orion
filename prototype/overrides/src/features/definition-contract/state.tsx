"use client";
import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from "react";
import { initialBindings, type Binding } from "./policy-model";
import { files as fixtures } from "./fixtures";
import { parseFiles, type Definition } from "./model";
export type Application = { revision: number; keys: string[]; at: string };
type State = {
  bindings: Record<string, Binding[]>;
  setBindings: Dispatch<SetStateAction<Record<string, Binding[]>>>;
  desired: Definition[];
  applied: Definition[];
  setApplied: Dispatch<SetStateAction<Definition[]>>;
  revision: number;
  setRevision: Dispatch<SetStateAction<number>>;
  history: Application[];
  setHistory: Dispatch<SetStateAction<Application[]>>;
};
const Context = createContext<State | null>(null);
export function ContractProvider({
  children,
  sources,
}: {
  children: ReactNode;
  sources: Record<string, string> | null;
}) {
  const [bindings, setBindings] = useState(initialBindings);
  const files = sources ?? fixtures;
  const desired = useMemo(() => parseFiles(files), [files]);
  const [applied, setApplied] = useState(() =>
    parseFiles({
      ...files,
      "domains/employee.yaml": (files["domains/employee.yaml"] ?? "").replace(
        "codes: [SEOUL, BUSAN]",
        "codes: [SEOUL, GYEONGGI]",
      ),
    }),
  );
  const [revision, setRevision] = useState(7);
  const [history, setHistory] = useState<Application[]>([]);
  return (
    <Context.Provider
      value={{
        bindings,
        setBindings,
        desired,
        applied,
        setApplied,
        revision,
        setRevision,
        history,
        setHistory,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useContract() {
  const state = useContext(Context);
  if (!state) throw Error("ContractProvider required");
  return state;
}
