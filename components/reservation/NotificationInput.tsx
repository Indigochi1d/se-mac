"use client";

import { useRef, useState } from "react";
import { AlertCircle, HelpCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { isValidDiscordWebhookUrl } from "@/lib/notification";

type NotificationMethod = "none" | "email" | "discord";

interface NotificationInputProps {
  method: NotificationMethod;
  onMethodChange: (method: NotificationMethod) => void;
  email: string;
  onEmailChange: (value: string) => void;
  discordWebhook: string;
  onDiscordWebhookChange: (value: string) => void;
}

const METHOD_OPTIONS: { value: NotificationMethod; label: string }[] = [
  { value: "none", label: "없음" },
  { value: "email", label: "이메일" },
  { value: "discord", label: "Discord 웹훅" },
];

export const NotificationInput = ({
  method,
  onMethodChange,
  email,
  onEmailChange,
  discordWebhook,
  onDiscordWebhookChange,
}: NotificationInputProps) => {
  const discordInputRef = useRef<HTMLInputElement>(null);
  const [discordError, setDiscordError] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  const handleDiscordBlur = () => {
    const value = discordWebhook.trim();
    if (value && !isValidDiscordWebhookUrl(value)) {
      setDiscordError(true);
      discordInputRef.current?.focus();
      return;
    }
    setDiscordError(false);
  };

  return (
    <div className="space-y-3">
      <Label>알림 방법 (선택)</Label>
      <div className="flex rounded-md border overflow-hidden">
        {METHOD_OPTIONS.map((option) => (
          <Button
            key={option.value}
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              "flex-1 rounded-none border-none",
              method === option.value
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "hover:bg-accent",
            )}
            onClick={() => onMethodChange(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>

      {method === "email" && (
        <div className="space-y-2">
          <Input
            type="email"
            placeholder="예약 결과를 받을 이메일 주소"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            예약 결과를 이메일로 알려드립니다.
          </p>
        </div>
      )}

      {method === "discord" && (
        <div className="space-y-2">
          <Input
            ref={discordInputRef}
            type="url"
            placeholder="https://discord.com/api/webhooks/..."
            value={discordWebhook}
            onChange={(e) => {
              onDiscordWebhookChange(e.target.value);
              if (discordError) setDiscordError(false);
            }}
            onBlur={handleDiscordBlur}
            aria-invalid={discordError}
          />
          {discordError ? (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
              <div className="space-y-1">
                <p className="text-sm text-destructive">
                  올바른 웹훅 URL을 입력해주세요.
                </p>
                <button
                  type="button"
                  onClick={() => setIsGuideOpen(true)}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                >
                  <HelpCircle className="size-3.5" />
                  올바른 웹훅 URL 안내보기
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Discord 채널의 웹훅 URL을 입력하면 해당 채널로 예약 결과를
              알려드립니다.
            </p>
          )}
        </div>
      )}

      <Dialog open={isGuideOpen} onOpenChange={setIsGuideOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discord 웹훅 URL 가져오는 방법</DialogTitle>
            <DialogDescription asChild>
              <ol className="list-decimal space-y-2 pl-4 text-left">
                <li>
                  Discord 서버에서 알림을 받을 채널의 <b>채널편집(⚙️)</b>을
                  엽니다.
                </li>
                <li>
                  좌측 메뉴에서 <b>연동</b>을 선택합니다.
                </li>
                <li>
                  <b>웹후크</b> 항목에서 <b>새 웹후크 만들기</b>를 클릭합니다.
                </li>
                <li>
                  웹후크 이름을 설정한 뒤 <b>웹후크 URL 복사</b>를 클릭합니다.
                </li>
                <li>복사한 URL을 입력창에 붙여넣습니다.</li>
              </ol>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
};
