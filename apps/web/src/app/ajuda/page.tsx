'use client'

import Link from 'next/link'
import { FormEvent, useMemo, useState } from 'react'

const WHATSAPP_NUMBER = '559298759201'

function onlyDigits(value: string) {
  return value.replace(/\D/g, '')
}

export default function AjudaPage() {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const canSubmit = useMemo(() => {
    return name.trim().length >= 3 && message.trim().length >= 5
  }, [message, name])

  function openWhatsappWithText(text: string) {
    const encoded = encodeURIComponent(text)
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encoded}`, '_blank')
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    if (!canSubmit) {
      setFormError('Preencha nome e mensagem antes de enviar.')
      return
    }

    const cleanPhone = onlyDigits(phone)
    const formattedText = [
      'Olá! Preciso de ajuda com meu pedido.',
      '',
      `Nome: ${name.trim()}`,
      `Telefone: ${cleanPhone || 'não informado'}`,
      `Mensagem: ${message.trim()}`,
    ].join('\n')

    openWhatsappWithText(formattedText)
  }

  return (
    <main className="mx-auto max-w-2xl p-4">
      <h1 className="text-2xl font-bold text-fuchsia-100">Ajuda</h1>
      <p className="text-acai-300 mt-2 text-sm">
        Envie sua mensagem para nossa equipe ou fale direto no WhatsApp.
      </p>

      <section className="border-acai-600 bg-acai-800/90 mt-4 rounded-2xl border p-5 shadow-lg">
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div>
            <label className="text-acai-300 mb-1 block text-xs font-medium">Nome</label>
            <input
              className="w-full rounded-lg p-3"
              placeholder="Seu nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="text-acai-300 mb-1 block text-xs font-medium">Telefone</label>
            <input
              className="w-full rounded-lg p-3"
              placeholder="(92) 00000-0000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
            />
          </div>

          <div>
            <label className="text-acai-300 mb-1 block text-xs font-medium">Mensagem</label>
            <textarea
              className="w-full rounded-lg p-3"
              placeholder="Descreva como podemos ajudar."
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
            />
          </div>

          {formError ? <p className="text-sm text-amber-400">{formError}</p> : null}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full rounded-xl bg-fuchsia-600 py-3 text-base font-semibold text-white shadow transition hover:bg-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Enviar mensagem
          </button>
        </form>

        <a
          href={`https://wa.me/${WHATSAPP_NUMBER}`}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex w-full items-center justify-center rounded-xl border border-acai-500 py-3 text-base font-semibold text-acai-100 transition hover:bg-acai-800"
        >
          Falar conosco no WhatsApp
        </a>
      </section>

      <footer className="mt-5">
        <Link
          href="/"
          className="inline-flex w-full items-center justify-center rounded-xl bg-fuchsia-600 py-3 text-base font-semibold text-white shadow transition hover:bg-fuchsia-500"
        >
          Voltar para página inicial
        </Link>
      </footer>
    </main>
  )
}
