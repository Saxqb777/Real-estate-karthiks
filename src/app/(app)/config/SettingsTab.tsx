"use client";
import { Panel, Skeleton } from "@/components/ui";
import { SettingsForm, useSettings } from "@/components/forms";
import s from "./config.module.css";

export function SettingsTab() {
  const settings = useSettings();
  return (
    <Panel fill padding="none" eyebrow="How the app works" title="Settings" className={s.settingsPanel}>
      {settings.data ? (
        <SettingsForm key={settings.data.updatedAt} settings={settings.data} />
      ) : (
        <div className={s.loading}>
          <Skeleton lines={8} />
        </div>
      )}
    </Panel>
  );
}
