<template>
  <div class="output" @input="handleInput" @change="handleInput">
    <div
      v-for="(line, index) in splitLines"
      :key="index"
      class="line-block"
      v-html="formatLine(line, index)"
      ref="lineBlocks"
    ></div>
  </div>
</template>

<script>
module.exports = {
  props: ['text', 'rowData'],
  data() {
    return {
      responses: typeof this.rowData.responses === 'string'
        ? JSON.parse(this.rowData.responses)
        : (this.rowData.responses || {})
    };
  },
  computed: {
    splitLines() {
      return this.text
        .replace(/-{10,}/g, '\n')
        .split(/(?=\n?\d+\))|(?=\n?\d+\.\s)/g)
        .map(l => l.trim())
        .filter(Boolean);
    }
  },
  methods: {
    formatLine(line, lineIndex) {
      const escaped = line.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      let groupCount = 0;

      return escaped
        .replace(/\(\s*([_\s]{3,})\)/g, (match, underscores, offset) => {
          const key = `text_${lineIndex}_${offset}`;
          const val = this.responses[key]?.value || '';
          return `<input data-key="${key}" type="text" value="${val}" style="width: ${underscores.length * 7}px" />`;
        })
        .replace(/\[\s*([_\s]{3,})\]/g, (match, underscores, offset) => {
          const key = `text_${lineIndex}_${offset}`;
          const val = this.responses[key]?.value || '';
          return `<input data-key="${key}" type="text" value="${val}" style="width: ${underscores.length * 7}px" />`;
        })
        .replace(/:\s*(_{3,})/g, (match, underscores, offset) => {
          const key = `text_${lineIndex}_${offset}`;
          const val = this.responses[key]?.value || '';
          return `: <input data-key="${key}" type="text" value="${val}" style="width: ${underscores.length * 7}px" />`;
        })
        .replace(/\[(x| )\]/gi, (match, xOrSpace, offset) => {
          const key = `checkbox_${lineIndex}_${offset}`;
          const checked = this.responses[key]?.value === true ? 'checked' : '';
          return `<input data-key="${key}" type="checkbox" ${checked} />`;
        })
        .replace(/\[([^\[\]\n\r]*?,[^\[\]\n\r]+?)\]/g, (match, options) => {
          const opts = options.split(',').map(opt => opt.trim());
          const groupName = `group_${lineIndex}_${groupCount++}`;
          return `<span class="radio-group">` +
            opts.map(opt => {
              const key = `${groupName}`;
              const checked = this.responses[key]?.value === opt ? 'checked' : '';
              return `
                <label class="radio-option">
                  <input type="radio" name="${groupName}" data-key="${key}" value="${opt}" ${checked} /> <span>${opt}</span>
                </label>
              `;
            }).join('') +
          `</span>`;
        });
    },
    handleInput(event) {
      const el = event.target;
      const key = el.dataset.key;
      if (!key) return;

      const user = fbUser?.email || 'unknown';
      const employee = this.rowData?.$currentEmployee$display || 'unknown';
      const timestamp = new Date().toLocaleString();

      let value;
      if (el.type === 'checkbox') {
        value = el.checked;
      } else if (el.type === 'radio') {
        value = el.value;
      } else {
        value = el.value;
      }

      this.responses[key] = { value, timestamp, user, employee };

      if (this.rowData?.rowKey) {
        $dgSetRow('workOrderMaterials', this.rowData.rowKey, {
          responses: JSON.stringify(this.responses)
        });
      }
    }
  }
}
</script>

<style scoped>
.output {
  font-family: monospace;
  color: black !important;
  white-space: pre-wrap;
  width: 605px;
}
.line-block {
  margin-bottom: 12px;
  color: black !important;
}
input[type="text"] {
  margin: 0 4px;
  display: inline-block;
  border: 1px solid black;
  border-radius: 0;
  border-bottom: 2px solid black;
}
input[type="checkbox"],
input[type="radio"] {
  margin: 0 4px;
  vertical-align: middle;
}
.radio-group {
  display: inline-flex;
  gap: 12px;
  align-items: center;
  margin-left: 6px;
}
.radio-option {
  display: inline-flex;
  align-items: center;
  font-size: 14px;
}
</style>
