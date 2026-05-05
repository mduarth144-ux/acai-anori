'use client'

import { useMemo } from 'react'

type FaqItem = {
  question: string
  answer: string
}

const FAQ_ITEMS: FaqItem[] = [
  {
    question: 'Qual o valor da taxa de entrega?',
    answer:
      'A taxa de entrega varia conforme o bairro e a distância. O valor final aparece na etapa de confirmação do pedido.',
  },
  {
    question: 'Quanto tempo leva para meu pedido chegar?',
    answer:
      'O prazo médio é de 30 a 60 minutos, podendo variar em horários de pico e condições de trânsito.',
  },
  {
    question: 'Vocês entregam em todos os bairros?',
    answer:
      'Atendemos bairros selecionados da região. Se houver indisponibilidade, o app informa durante o checkout.',
  },
  {
    question: 'Quais formas de pagamento são aceitas?',
    answer:
      'Aceitamos PIX, cartão de débito, cartão de crédito e dinheiro na entrega (com opção de troco).',
  },
  {
    question: 'Posso retirar no local?',
    answer:
      'Sim. Na finalização do pedido, selecione a opção "Retirada".',
  },
  {
    question: 'Posso cancelar ou alterar um pedido?',
    answer:
      'Você pode solicitar alterações ou cancelamento o quanto antes pelo nosso atendimento. Após preparo iniciado, pode haver restrições.',
  },
]

export default function AjudaPage() {
  const items = useMemo(() => FAQ_ITEMS, [])

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl p-4 pb-[calc(7rem+env(safe-area-inset-bottom))]">
      <section className="rounded-2xl border border-acai-600 bg-acai-800/90 p-4 shadow-lg">
        <h1 className="text-2xl font-bold text-fuchsia-100">Ajuda e Perguntas Frequentes</h1>
        <p className="mt-2 text-sm text-acai-200">
          Respostas rápidas para as dúvidas mais comuns sobre entrega, pagamento e pedidos.
        </p>
      </section>

      <section className="mt-4 space-y-3">
        {items.map((item) => (
          <article
            key={item.question}
            className="rounded-2xl border border-acai-600 bg-acai-800/80 p-4 shadow-md"
          >
            <h2 className="text-base font-semibold text-fuchsia-200">{item.question}</h2>
            <p className="mt-2 text-sm leading-6 text-acai-100">{item.answer}</p>
          </article>
        ))}
      </section>
    </main>
  )
}
