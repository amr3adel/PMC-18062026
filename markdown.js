(function () {
  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function inlineMarkdown(value) {
    return escapeHtml(value)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
  }

  function render(markdown) {
    const lines = String(markdown || "").split(/\r?\n/);
    const html = [];
    let inList = false;
    let inCode = false;
    const codeLines = [];

    function closeList() {
      if (inList) {
        html.push("</ul>");
        inList = false;
      }
    }

    lines.forEach((line) => {
      if (line.trim().startsWith("```")) {
        if (inCode) {
          html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
          codeLines.length = 0;
          inCode = false;
        } else {
          closeList();
          inCode = true;
        }
        return;
      }

      if (inCode) {
        codeLines.push(line);
        return;
      }

      if (!line.trim()) {
        closeList();
        return;
      }

      const listMatch = line.match(/^\s*[-*]\s+(.+)/);
      if (listMatch) {
        if (!inList) {
          html.push("<ul>");
          inList = true;
        }
        html.push(`<li>${inlineMarkdown(listMatch[1])}</li>`);
        return;
      }

      closeList();
      html.push(`<p>${inlineMarkdown(line)}</p>`);
    });

    if (inCode) html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
    closeList();
    return html.join("");
  }

  window.TaskMarkdown = {
    render,
  };
})();
