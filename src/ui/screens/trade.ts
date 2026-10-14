import { S, count, createTrade, redeemTrade } from '../../core/state';
import { ITEM_LIST, isTradeable, item } from '../../data/items';
import { RARITIES } from '../../data/rarity';
import { sfx } from '../../audio/sfx';
import { render } from '../app';
import { el, esc, modal, toast } from '../dom';
import { ico, KIND_ICON } from '../icons';

/** Trocas entre jogadores através de códigos de transferência. */
export function openTrade(preselect?: string): void {
  const body = el('div', 'trade');
  body.innerHTML = `
    <div class="seg"><button class="on" data-t="send">Send</button><button data-t="recv">Receive</button></div>
    <div class="trade-pane"></div>
    <p class="muted small">How it works: pick items and generate a code. The items leave your inventory and go to whoever redeems the code. Send it to a friend in a message. Each code can only be used once per device.</p>`;
  const pane = body.querySelector('.trade-pane') as HTMLElement;
  const tabs = body.querySelectorAll('.seg button');
  const selected = new Map<string, number>();
  if (preselect) selected.set(preselect, 1);

  const send = () => {
    pane.innerHTML = '';
    const list = ITEM_LIST.filter((d) => isTradeable(d) && count(d.id) > 0).sort((a, b) => RARITIES[b.rarity].tier - RARITIES[a.rarity].tier);
    if (!list.length) {
      pane.appendChild(el('p', 'muted', 'You have no tradeable items yet. Starter items cannot be traded.'));
      return;
    }
    const g = el('div', 'trade-list');
    for (const d of list) {
      const row = el('label', `trade-row r-${d.rarity}`);
      const n = selected.get(d.id) ?? 0;
      row.innerHTML = `<input type="checkbox" ${n ? 'checked' : ''}/><span class="tr-ico">${ico(KIND_ICON[d.kind] ?? 'star')}</span><span class="tr-name">${esc(d.name)}<small class="rar rar-${d.rarity}">${RARITIES[d.rarity].name}</small></span><span class="tr-n">×${count(d.id)}</span>`;
      const cb = row.querySelector('input') as HTMLInputElement;
      cb.onchange = () => {
        if (cb.checked) selected.set(d.id, 1);
        else selected.delete(d.id);
      };
      g.appendChild(row);
    }
    pane.appendChild(g);
    const btn = el('button', 'btn btn-gold', 'Generate code');
    btn.onclick = () => {
      if (!selected.size) {
        toast('Pick at least one item.', 'info');
        return;
      }
      const names = [...selected.keys()].map((id) => item(id).name).join(', ');
      modal('Confirm trade', `<p>These items will be removed from your inventory: <b>${esc(names)}</b>.</p><p class="muted small">Keep the code safe: whoever redeems it gets the items.</p>`, [
        { label: 'Cancel' },
        {
          label: 'Confirm',
          cls: 'btn-gold',
          onClick: () => {
            const code = createTrade([...selected.entries()], S.name);
            if (!code) {
              toast('Could not create the code.', 'err');
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
    box.innerHTML = `<p>Trade code:</p><textarea readonly rows="4">${esc(code)}</textarea>`;
    const ta = box.querySelector('textarea') as HTMLTextAreaElement;
    modal('Code created', box, [
      {
        label: 'Copy',
        cls: 'btn-gold',
        onClick: () => {
          ta.select();
          navigator.clipboard?.writeText(code).then(
            () => toast('Copied!', 'ok'),
            () => toast('Select it and copy it manually.', 'info'),
          );
          return false;
        },
      },
      ...(navigator.share
        ? [
            {
              label: 'Share',
              cls: 'btn-blue',
              onClick: () => {
                navigator.share({ title: 'Kings of the Ring — trade', text: code }).catch(() => {});
                return false;
              },
            },
          ]
        : []),
      { label: 'Close' },
    ]);
  };

  const recv = () => {
    pane.innerHTML = `<textarea class="code-in" rows="4" placeholder="Paste the RDR-... code here"></textarea>`;
    const btn = el('button', 'btn btn-gold', 'Redeem');
    btn.onclick = () => {
      const v = (pane.querySelector('.code-in') as HTMLTextAreaElement).value;
      const r = redeemTrade(v);
      if (!r.ok) {
        toast(r.error, 'err');
        return;
      }
      sfx.reveal(4);
      toast(`You received ${r.items.map(([id, n]) => `${item(id).name}${n > 1 ? ' ×' + n : ''}`).join(', ')}${r.from ? ` from ${r.from}` : ''}!`, 'ok');
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
  modal(`${ico('swap')} Trades`, body, [], 'trade-modal');
}
