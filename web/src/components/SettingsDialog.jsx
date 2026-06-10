import { useTranslation } from 'react-i18next'
import { Settings } from 'lucide-react'
import { useSettings } from '@/lib/settings'
import { cn } from '@/lib/utils'
import { SuitGlyph } from '@/practice/bridge'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogClose,
} from '@/components/ui/dialog'

function OptionGroup({ label, hint, value, options, onChange }) {
  return (
    <div className="space-y-1.5">
      <div className="text-sm font-medium">{label}</div>
      <div className="inline-flex rounded-lg border border-border bg-muted/40 p-1">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              value === o.value
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

export default function SettingsDialog() {
  const { t } = useTranslation()
  const { theme, textSize, deck, feedback, set } = useSettings()

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('settings.open')}>
          <Settings />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('settings.title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <section className="space-y-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('settings.appearance')}
            </h4>

            <OptionGroup
              label={t('settings.theme')}
              value={theme}
              onChange={(v) => set({ theme: v })}
              options={[
                { value: 'system', label: t('settings.themeSystem') },
                { value: 'light', label: t('settings.themeLight') },
                { value: 'dark', label: t('settings.themeDark') },
              ]}
            />

            <OptionGroup
              label={t('settings.textSize')}
              value={textSize}
              onChange={(v) => set({ textSize: v })}
              options={[
                { value: 'normal', label: t('settings.textNormal') },
                { value: 'large', label: t('settings.textLarge') },
              ]}
            />

            <div className="space-y-1.5">
              <OptionGroup
                label={t('settings.deck')}
                value={deck}
                onChange={(v) => set({ deck: v })}
                options={[
                  { value: '4color', label: t('settings.deck4') },
                  { value: '2color', label: t('settings.deck2') },
                ]}
              />
              <div className="flex items-center gap-3 pl-1 text-2xl leading-none">
                <SuitGlyph s="S" /><SuitGlyph s="H" /><SuitGlyph s="D" /><SuitGlyph s="C" />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('settings.practiceGroup')}
            </h4>
            <OptionGroup
              label={t('settings.feedback')}
              hint={t('settings.feedbackHint')}
              value={feedback}
              onChange={(v) => set({ feedback: v })}
              options={[
                { value: 'minimal', label: t('settings.feedbackMinimal') },
                { value: 'standard', label: t('settings.feedbackStandard') },
                { value: 'detailed', label: t('settings.feedbackDetailed') },
              ]}
            />
          </section>
        </div>

        <div className="mt-6 flex justify-end">
          <DialogClose asChild>
            <Button>{t('settings.done')}</Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  )
}
