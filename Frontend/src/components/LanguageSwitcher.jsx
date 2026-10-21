import { useEffect, useRef, useState } from "react"
import { languageOptions, useLocale } from "../i18n"
import "./language-switcher.css"

export default function LanguageSwitcher() {
    const { language: selected, setLanguage, t } = useLocale()
    const [open, setOpen] = useState(false)
    const rootRef = useRef(null)
    const currentLanguage = languageOptions.find((language) => language.code === selected)

    useEffect(() => {
        document.documentElement.lang = selected
        const onPointerDown = (event) => {
            if (!rootRef.current?.contains(event.target)) setOpen(false)
        }
        const onKeyDown = (event) => {
            if (event.key === "Escape") setOpen(false)
        }
        document.addEventListener("pointerdown", onPointerDown)
        document.addEventListener("keydown", onKeyDown)
        return () => {
            document.removeEventListener("pointerdown", onPointerDown)
            document.removeEventListener("keydown", onKeyDown)
        }
    }, [selected])

    const chooseLanguage = (code) => {
        setLanguage(code)
        setOpen(false)
    }

    return (
        <div className="language-switcher" ref={rootRef}>
            {open && (
                <section className="language-menu" aria-label={t("Choose your preferred language")}>
                    <div className="language-menu-heading">
                        <span className="language-menu-title">{t("Language")}</span>
                        <span className="language-menu-subtitle">{t("Choose your preferred language")}</span>
                    </div>
                    <div className="language-options" role="listbox" aria-label="Languages">
                        {languageOptions.map((language) => (
                            <button
                                className={`language-option${selected === language.code ? " is-selected" : ""}`}
                                key={language.code}
                                type="button"
                                role="option"
                                aria-selected={selected === language.code}
                                onClick={() => chooseLanguage(language.code)}
                            >
                                <span className="language-option-label">{language.nativeLabel}</span>
                                <span className="language-option-name">{language.name}</span>
                                {selected === language.code && <span className="language-check" aria-hidden="true">✓</span>}
                            </button>
                        ))}
                    </div>
                </section>
            )}
            <button
                className="language-trigger"
                type="button"
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-label={`${t("Language")}: ${currentLanguage.name}`}
                onClick={() => setOpen((isOpen) => !isOpen)}
            >
                <svg viewBox="0 0 24 24" aria-hidden="true" fill="none">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M3.5 12h17M12 3c2.2 2.4 3.3 5.4 3.3 9s-1.1 6.6-3.3 9c-2.2-2.4-3.3-5.4-3.3-9S9.8 5.4 12 3Z" />
                </svg>
                <span>{currentLanguage.code.toUpperCase()}</span>
            </button>
        </div>
    )
}
