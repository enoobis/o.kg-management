
(function () {
  const STORAGE_KEY = "rdlMap";
  const $ = s => document.querySelector(s);
  function render(map) {
    const tbody = $("#list tbody");
    tbody.innerHTML = "";
    for (const [k,v] of Object.entries(map).sort((a,b)=>a[0].localeCompare(b[0]))) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td><input type="text" class="key" value="${k}"></td>
                      <td><input type="text" class="val" value="${v}"></td>
                      <td class="row-actions"><button class="save">Сохранить</button><button class="del">Удалить</button></td>`;
      tr.querySelector(".save").onclick = async () => {
        const nk = tr.querySelector(".key").value.trim();
        const nv = tr.querySelector(".val").value.trim();
        const data = await chrome.storage.local.get(STORAGE_KEY);
        const map2 = data[STORAGE_KEY] || {};
        if (nk !== k) delete map2[k];
        if (nv) map2[nk] = nv; else delete map2[nk];
        await chrome.storage.local.set({[STORAGE_KEY]: map2});
        render(map2);
      };
      tr.querySelector(".del").onclick = async () => {
        const data = await chrome.storage.local.get(STORAGE_KEY);
        const map2 = data[STORAGE_KEY] || {};
        delete map2[k];
        await chrome.storage.local.set({[STORAGE_KEY]: map2});
        render(map2);
      };
      tbody.appendChild(tr);
    }
  }
  function load() {
    chrome.storage.local.get(STORAGE_KEY, res => render(res[STORAGE_KEY] || {}));
  }
  $("#add").onclick = async () => {
    const key = prompt("Введите ключ", "MAC:");
    if (!key) return;
    const val = prompt("Введите подпись", "");
    const data = await chrome.storage.local.get(STORAGE_KEY);
    const map = data[STORAGE_KEY] || {};
    if (val) map[key] = val;
    await chrome.storage.local.set({[STORAGE_KEY]: map});
    load();
  };
  $("#clear").onclick = async () => {
    if (!confirm("Удалить всё?")) return;
    await chrome.storage.local.set({[STORAGE_KEY]: {}});
    load();
  };
  load();
})();
