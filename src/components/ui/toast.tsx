"use client";
import * as Primitive from "@radix-ui/react-toast";
import {
  createContext,
  useContext,
  useState,
  useRef,
  type ReactNode,
} from "react";
import { Button } from "./button";
type Message = { id: number; title: string; description?: string };
const Context = createContext<
  ((title: string, description?: string) => void) | null
>(null);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const nextId = useRef(0);
  function notify(title: string, description?: string) {
    setMessages((current) => [
      ...current.slice(-3),
      { id: ++nextId.current, title, description },
    ]);
  }
  return (
    <Context.Provider value={notify}>
      <Primitive.Provider duration={6000} label="알림">
        {children}
        {messages.map((message) => (
          <Primitive.Root
            className="ui-toast"
            key={message.id}
            onOpenChange={(open) => {
              if (!open)
                setMessages((current) =>
                  current.filter((item) => item.id !== message.id),
                );
            }}
          >
            <div>
              <Primitive.Title className="ui-toast-title">
                {message.title}
              </Primitive.Title>
              {message.description && (
                <Primitive.Description>
                  {message.description}
                </Primitive.Description>
              )}
            </div>
            <Primitive.Close asChild>
              <Button size="sm" variant="ghost" aria-label="알림 닫기">
                ×
              </Button>
            </Primitive.Close>
          </Primitive.Root>
        ))}
        <Primitive.Viewport
          className="ui-toast-viewport"
          label="알림 ({hotkey})"
        />
      </Primitive.Provider>
    </Context.Provider>
  );
}
export function useToast() {
  const value = useContext(Context);
  if (!value) throw new Error("useToast requires ToastProvider");
  return value;
}
