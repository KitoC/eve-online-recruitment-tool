import React, { useState, useEffect, useRef } from "react";

const TemplateEditor = ({ template, csvData, onTemplateChange }) => {
  const [subject, setSubject] = useState(template.subject || "");
  const [body, setBody] = useState(template.body || "");
  const subjectRef = useRef(null);
  const bodyRef = useRef(null);
  const isUpdatingFromProps = useRef(false);
  const prevTemplateRef = useRef(template);

  // Update local state when template prop changes (from API load)
  useEffect(() => {
    // Only update if template actually changed
    if (
      prevTemplateRef.current.subject !== template.subject ||
      prevTemplateRef.current.body !== template.body
    ) {
      isUpdatingFromProps.current = true;
      const newSubject = template.subject || "";
      const newBody = template.body || "";
      setSubject(newSubject);
      setBody(newBody);
      prevTemplateRef.current = template;
      // Reset flag and update styled content after state sync
      setTimeout(() => {
        isUpdatingFromProps.current = false;
        // Update styled content with the new values
        if (subjectRef.current)
          updateStyledContent(subjectRef.current, newSubject);
        if (bodyRef.current) updateStyledContent(bodyRef.current, newBody);
      }, 0);
    }
  }, [template.subject, template.body]);

  // Only update parent when user makes changes (not when syncing from props)
  useEffect(() => {
    if (isUpdatingFromProps.current) {
      return;
    }
    onTemplateChange({ subject, body, variables: template.variables || {} });
  }, [subject, body]);

  // Update styled content when subject or body changes (but not during prop sync)
  useEffect(() => {
    if (isUpdatingFromProps.current) {
      return;
    }
    if (subjectRef.current) {
      updateStyledContent(subjectRef.current, subject);
    }
  }, [subject]);

  useEffect(() => {
    if (isUpdatingFromProps.current) {
      return;
    }
    if (bodyRef.current) {
      updateStyledContent(bodyRef.current, body);
    }
  }, [body]);

  // Initial population when component mounts or template loads
  useEffect(() => {
    // Wait a bit for refs to be ready
    const timer = setTimeout(() => {
      if (subjectRef.current && subject) {
        const currentText = subjectRef.current.textContent || "";
        if (currentText.trim() !== subject.trim()) {
          updateStyledContent(subjectRef.current, subject);
        }
      }
      if (bodyRef.current && body) {
        const currentText = bodyRef.current.textContent || "";
        if (currentText.trim() !== body.trim()) {
          updateStyledContent(bodyRef.current, body);
        }
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [subject, body]); // Re-run when template loads

  // Style variables in contenteditable
  const updateStyledContent = (element, text) => {
    if (!element) return;

    // Save cursor position
    const selection = window.getSelection();
    let cursorPosition = 0;
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      cursorPosition = range.startOffset;
    }

    const variableRegex = /%%([^%]+)%%/g;
    let html = "";
    let lastIndex = 0;
    let match;

    while ((match = variableRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        html += escapeHtml(text.substring(lastIndex, match.index));
      }
      html += `<span class="variable-in-text" style="background: rgba(0, 102, 255, 0.3); color: #00ccff; padding: 2px 4px; border-radius: 2px; font-weight: 600;">${escapeHtml(
        match[0]
      )}</span>`;
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
      html += escapeHtml(text.substring(lastIndex));
    }

    // Only update if content changed to avoid cursor jumping
    if (element.innerHTML !== html) {
      element.innerHTML = html || "<br>";

      // Restore cursor position
      try {
        const range = document.createRange();
        const selection = window.getSelection();
        const textNode = getTextNodeAtPosition(element, cursorPosition);
        if (textNode) {
          range.setStart(
            textNode,
            Math.min(cursorPosition, textNode.textContent.length)
          );
          range.setEnd(
            textNode,
            Math.min(cursorPosition, textNode.textContent.length)
          );
          selection.removeAllRanges();
          selection.addRange(range);
        }
      } catch (e) {
        // Ignore cursor restoration errors
      }
    }
  };

  const getTextNodeAtPosition = (root, index) => {
    const treeWalker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    let currentIndex = 0;
    let node;
    while ((node = treeWalker.nextNode())) {
      const nodeLength = node.textContent.length;
      if (currentIndex + nodeLength >= index) {
        return node;
      }
      currentIndex += nodeLength;
    }
    return null;
  };

  const escapeHtml = (text) => {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  };

  const getPlainText = (element) => {
    return element.innerText || element.textContent || "";
  };

  const handleInput = (setter) => {
    return (e) => {
      const text = getPlainText(e.target);
      setter(text);
      // Style will be updated by useEffect
    };
  };

  // Drag and drop handlers
  const handleDragStart = (e, variable) => {
    e.dataTransfer.setData("text/plain", `%%${variable}%%`);
    e.dataTransfer.effectAllowed = "copy";
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = (e, ref, setter) => {
    e.preventDefault();
    const variable = e.dataTransfer.getData("text/plain");
    const element = ref.current;

    if (!element) return;

    // Get cursor position
    const selection = window.getSelection();
    let cursorPosition = 0;
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      cursorPosition = range.startOffset;
    }

    const currentText = getPlainText(element);
    const newText =
      currentText.substring(0, cursorPosition) +
      variable +
      currentText.substring(cursorPosition);

    setter(newText);

    // Update styled content and restore cursor
    setTimeout(() => {
      updateStyledContent(element, newText);
      // Restore cursor after variable
      try {
        const range = document.createRange();
        const selection = window.getSelection();
        const textNode = getTextNodeAtPosition(
          element,
          cursorPosition + variable.length
        );
        if (textNode) {
          const pos = Math.min(
            cursorPosition + variable.length,
            textNode.textContent.length
          );
          range.setStart(textNode, pos);
          range.setEnd(textNode, pos);
          selection.removeAllRanges();
          selection.addRange(range);
        }
        element.focus();
      } catch (e) {
        // Ignore cursor restoration errors
      }
    }, 0);
  };

  // Click to insert (fallback)
  const handleVariableClick = (variable, ref, setter) => {
    const element = ref.current;
    if (!element) return;

    const selection = window.getSelection();
    let cursorPosition = 0;
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      cursorPosition = range.startOffset;
    }

    const currentText = getPlainText(element);
    const newText =
      currentText.substring(0, cursorPosition) +
      `%%${variable}%%` +
      currentText.substring(cursorPosition);

    setter(newText);

    setTimeout(() => {
      updateStyledContent(element, newText);
      // Restore cursor after variable
      try {
        const range = document.createRange();
        const selection = window.getSelection();
        const textNode = getTextNodeAtPosition(
          element,
          cursorPosition + `%%${variable}%%`.length
        );
        if (textNode) {
          const pos = Math.min(
            cursorPosition + `%%${variable}%%`.length,
            textNode.textContent.length
          );
          range.setStart(textNode, pos);
          range.setEnd(textNode, pos);
          selection.removeAllRanges();
          selection.addRange(range);
        }
        element.focus();
      } catch (e) {
        // Ignore cursor restoration errors
      }
    }, 0);
  };

  const variables = csvData?.variables || [];

  // Preview
  let previewSubject = subject;
  let previewBody = body;
  if (csvData?.firstRow) {
    Object.keys(csvData.firstRow).forEach((key) => {
      const placeholder = `%%${key}%%`;
      previewSubject = previewSubject.replace(
        new RegExp(placeholder, "g"),
        csvData.firstRow[key] || ""
      );
      previewBody = previewBody.replace(
        new RegExp(placeholder, "g"),
        csvData.firstRow[key] || ""
      );
    });
  }

  return (
    <div className="section">
      <h2>✏️ Message Template</h2>
      <div style={{ display: "flex", gap: "20px" }}>
        <div
          className="variables-panel"
          style={{
            background: "rgba(0, 20, 40, 0.6)",
            padding: "15px",
            borderRadius: "2px",
            border: "1px solid rgba(0, 153, 255, 0.2)",
          }}
        >
          <h3
            style={{
              marginBottom: "10px",
              fontSize: "0.8rem",
              color: "#00ccff",
              textTransform: "uppercase",
              letterSpacing: "1px",
              fontWeight: 300,
            }}
          >
            Available Variables (Drag to insert)
          </h3>
          <div
            className="variable-list"
            style={{ display: "flex", dlexDirection: "column", gap: "8px" }}
          >
            {variables.map((variable) => (
              <span
                key={variable}
                className="variable-tag"
                draggable
                onDragStart={(e) => handleDragStart(e, variable)}
                onClick={() => {
                  const activeElement = document.activeElement;
                  if (activeElement === subjectRef.current) {
                    handleVariableClick(variable, subjectRef, setSubject);
                  } else if (activeElement === bodyRef.current) {
                    handleVariableClick(variable, bodyRef, setBody);
                  } else {
                    // Default to body if nothing is focused
                    handleVariableClick(variable, bodyRef, setBody);
                  }
                }}
                style={{
                  background: "rgba(0, 102, 255, 0.2)",
                  color: "#00ccff",
                  padding: "6px 12px",
                  borderRadius: "2px",
                  fontSize: "0.85rem",
                  cursor: "grab",
                  userSelect: "none",
                  border: "1px solid rgba(0, 153, 255, 0.4)",
                  fontFamily: "'Courier New', monospace",
                  transition: "all 0.2s ease",
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.cursor = "grabbing";
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.cursor = "grab";
                }}
              >
                %%{variable}%%
              </span>
            ))}
          </div>
        </div>
        <div
          className="template-editor"
          style={{ display: "grid", gap: "20px" }}
        >
          <div
            className="template-field"
            style={{ display: "flex", flexDirection: "column" }}
          >
            <label
              style={{
                marginBottom: "8px",
                color: "#88aacc",
                fontWeight: 500,
                fontSize: "0.9rem",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              Subject
            </label>
            <div
              ref={subjectRef}
              contentEditable
              onInput={handleInput(setSubject)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, subjectRef, setSubject)}
              suppressContentEditableWarning
              style={{
                padding: "12px",
                border: "1px solid rgba(0, 153, 255, 0.3)",
                borderRadius: "2px",
                fontSize: "1rem",
                fontFamily: "'Courier New', monospace",
                background: "rgba(5, 10, 20, 0.6)",
                color: "#e0e0e0",
                minHeight: "40px",
                cursor: "text",
                outline: "none",
              }}
              data-placeholder="Enter email subject"
            />
          </div>
          <div
            className="template-field"
            style={{ display: "flex", flexDirection: "column" }}
          >
            <label
              style={{
                marginBottom: "8px",
                color: "#88aacc",
                fontWeight: 500,
                fontSize: "0.9rem",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              Body
            </label>
            <div
              ref={bodyRef}
              contentEditable
              onInput={handleInput(setBody)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, bodyRef, setBody)}
              suppressContentEditableWarning
              style={{
                padding: "12px",
                border: "1px solid rgba(0, 153, 255, 0.3)",
                borderRadius: "2px",
                fontSize: "1rem",
                fontFamily: "'Courier New', monospace",
                background: "rgba(5, 10, 20, 0.6)",
                color: "#e0e0e0",
                minHeight: "150px",
                cursor: "text",
                outline: "none",
                whiteSpace: "pre-wrap",
              }}
              data-placeholder="Enter email body"
            />
          </div>
        </div>
      </div>
      <div
        className="preview-section"
        style={{
          marginTop: "20px",
          padding: "15px",
          background: "rgba(5, 10, 20, 0.6)",
          border: "1px dashed rgba(0, 153, 255, 0.3)",
          borderRadius: "2px",
        }}
      >
        <h3
          style={{
            marginBottom: "10px",
            color: "#00ccff",
            fontWeight: 300,
            textTransform: "uppercase",
            letterSpacing: "1px",
            fontSize: "0.9rem",
          }}
        >
          Preview (using first row data)
        </h3>
        <div
          className="preview-content"
          style={{
            color: "#88aacc",
            fontSize: "0.9rem",
            fontFamily: "'Courier New', monospace",
          }}
        >
          <strong>Subject:</strong> {previewSubject}
          <br />
          <br />
          <strong>Body:</strong>
          <br />
          <pre
            style={{
              whiteSpace: "pre-wrap",
              background: "rgba(0, 0, 0, 0.3)",
              padding: "10px",
              borderRadius: "2px",
              border: "1px solid rgba(0, 153, 255, 0.2)",
              color: "#e0e0e0",
            }}
          >
            {previewBody}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default TemplateEditor;
