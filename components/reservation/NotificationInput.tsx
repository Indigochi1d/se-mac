"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
            type="url"
            placeholder="https://discord.com/api/webhooks/..."
            value={discordWebhook}
            onChange={(e) => onDiscordWebhookChange(e.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            Discord 채널의 웹훅 URL을 입력하면 해당 채널로 예약 결과를
            알려드립니다.
          </p>
        </div>
      )}
    </div>
  );
};
