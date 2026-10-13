import { S, count, createTrade, redeemTrade } from '../../core/state';
import { ITEM_LIST, isTradeable, item } from '../../data/items';
import { RARITIES } from '../../data/rarity';
import { sfx } from '../../audio/sfx';
import { render } from '../app';
import { el, esc, modal, toast } from '../dom';

/** Trocas entre jogadores através de códigos de transferência. */
export function openTrade(preselect?: string): void {
  const body = el('div', 'trade');
  body.innerHTML = `
    <div class="seg"><button class="on" data-t="send">Enviar</button><button data-t="recv">Receber</button></div>
    <div class="trade-pane"></div>
    <p class="muted small">Como funciona: escolhe itens e gera um código. Os itens saem do teu inventário e passam para quem resgatar o código. Envia-o por mensagem a um amigo. Cada código só pode ser usado uma vez em cada dispositivo.</p>`;
  const pane = body.querySelector('.trade-pane') as HTMLElement;
  const tabs = body.querySelectorAll('.seg button');
  const selected = new Map<string, number>();
  if (preselect) selected.set(preselect, 1);

  const send = () => {
    pane.innerHTML = '';
    const list = ITEM_LIST.filter((d) => isTradeable(d) && count(d.id) > 0).sort((a, b) => RARITIES[b.rarity].tier - RARITIES[a.rarity].tier);
    if (!list.length) {
      pane.appendChild(el('p', 'muted', 'Ainda não tens itens que se possam trocar. Os itens iniciais não são trocáveis.'));
      return;
    }
    const g = el('div', 'trade-list');
    for (const d of list) {
      const row = el('label', `trade-row r-${d.rarity}`);
      const n = selected.get(d.id) ?? 0;
      row.innerHTML = `<input type="checkbox" ${n ? 'checked' : ''}/><span class="tr-ico">${d.icon}</span><span class="tr-name">${esc(d.name)}<small class="rar rar-${d.rarity}">${RARITIES[d.rarity].name}</small></span><span class="tr-n">×${count(d.id)}</span>`;
      const cb = row.querySelector('input') as HTMLInputElement;
      cb.onchange = () => {
        if (cb.checked) selected.set(d.id, 1);
        else selected.delete(d.id);
      };
      g.appendChild(row);
    }
    pane.appendChild(g);
    const btn = el('button', 'btn btn-gold', 'Gerar código');
    btn.onclick = () => {
      if (!selected.size) {
        toast('Escolhe pelo menos um item.', 'info');
        return;
      }
      const names = [...selected.keys()].map((id) => item(id).name).join(', ');
      modal('Confirmar troca', `<p>Vais retirar do teu inventário: <b>${esc(names)}</b>.</p><p class="muted small">Guarda bem o código: quem o resgatar recebe os itens.</p>`, [
        { label: 'Cancelar' },
        {
          label: 'Confirmar',
          cls: 'btn-gold',
          onClick: () => {
            const code = createTrade([...selected.entries()], S.name);
            if (!code) {
              toast('Não foi possível criar o código.', 'err');
              return;
            }
            selected.clear();
            sfx.coin();
            showCode(code);
            render();
          },
        },
      ]);
    };
    pane.appendChild(btn);
  };

  const showCode = (code: string) => {
    const box = el('div', 'code-box');
    box.innerHTML = `<p>Código de troca:</p><textarea readonly rows="4">${esc(code)}</textarea>`;
    const ta = box.querySelector('textarea') as HTMLTextAreaElement;
    modal('Código criado', box, [
      {
        label: 'Copiar',
        cls: 'btn-gold',
        onClick: () => {
          ta.select();
          navigator.clipboard?.writeText(code).then(
            () => toast('Copiado!', 'ok'),
            () => toast('Seleciona e copia manualmente.', 'info'),
          );
          return false;
        },
      },
      ...(navigator.share
        ? [
            {
              label: 'Partilhar',
              cls: 'btn-blue',
              onClick: () => {
                navigator.share({ title: 'Reis do Ringue — troca', text: code }).catch(() => {});
                return false;
              },
            },
          ]
        : []),
      { label: 'Fechar' },
    ]);
  };

  const recv = () => {
    pane.innerHTML = `<textarea class="code-in" rows="4" placeholder="Cola aqui o código RDR-..."></textarea>`;
    const btn = el('button', 'btn btn-gold', 'Resgatar');
    btn.onclick = () => {
      const v = (pane.querySelector('.code-in') as HTMLTextAreaElement).value;
      const r = redeemTrade(v);
      if (!r.ok) {
        toast(r.error, 'err');
        return;
      }
      sfx.reveal(4);
      toast(`Recebeste ${r.items.map(([id, n]) => `${item(id).name}${n > 1 ? ' ×' + n : ''}`).join(', ')}${r.from ? ` de ${r.from}` : ''}!`, 'ok');
      render();
      (pane.querySelector('.code-in') as HTMLTextAreaElement).value = '';
    };
    pane.appendChild(btn);
  };

  tabs.forEach((b) => {
    (b as HTMLElement).onclick = () => {
      tabs.forEach((x) => x.classList.toggle('on', x === b));
      if ((b as HTMLElement).dataset.t === 'send') send();
      else recv();
    };
  });
  send();
  modal('🔁 Trocas', body, [], 'trade-modal');
}
