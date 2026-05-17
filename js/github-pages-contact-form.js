(function () {
  var form = document.getElementById("addFormw202208048cd9c0bc005d8");
  if (!form || !window.SITE_FORM) {
    return;
  }

  var widgetCode = form.id.replace(/^addForm/, "");
  var config = Object.assign(
    {
      endpoint: "https://formsubmit.co/ajax/hsptool@naver.com",
      provider: "formsubmit",
      successMessage: "문의가 정상 접수되었습니다. 확인 후 연락드리겠습니다.",
      subjectPrefix: "[049GAN CONTACT]",
      fromName: "049GAN",
      requestTimeoutMs: 15000,
      fallbackErrorMessage: "문의 전송 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
      networkErrorMessage: "문의 전송 서비스에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      missingConfigMessage: "문의 전송 설정이 아직 완료되지 않았습니다. 관리자에게 문의해 주세요."
    },
    window.GITHUB_PAGES_CONTACT_FORM || {}
  );

  var completeModal = document.getElementById("input_form_complete_modal_" + widgetCode);
  var errorModal = document.getElementById("input_form_error_modal_" + widgetCode);
  if (!completeModal || !errorModal) {
    return;
  }

  var completeMessage = completeModal.querySelector(".container-fluid p");
  var completeButtons = completeModal.querySelector(".btn-group-justified");
  var errorMessage = errorModal.querySelector(".container-fluid p");
  var errorButtons = errorModal.querySelector(".btn-group-justified");

  var originalCompleteMessage = completeMessage.innerHTML;
  var originalCompleteButtons = completeButtons.innerHTML;
  var isSubmitting = false;

  var originalConfirmInputForm = typeof window.SITE_FORM.confirmInputForm === "function"
    ? window.SITE_FORM.confirmInputForm.bind(window.SITE_FORM)
    : null;
  var originalSubmit = typeof window.SITE_FORM.submit === "function"
    ? window.SITE_FORM.submit.bind(window.SITE_FORM)
    : null;

  function closeModal() {
    document.querySelectorAll(".modal.in.modal_site_alert").forEach(function (modal) {
      modal.style.display = "none";
    });
    document.body.classList.remove("site_alert_open");
  }

  function openModal(modal) {
    closeModal();
    document.body.classList.add("site_alert_open");
    modal.style.display = "block";
  }

  function wireButtons(container, handlers) {
    var buttons = container.querySelectorAll("a.btn");
    handlers.forEach(function (handler, index) {
      var button = buttons[index];
      if (!button) {
        return;
      }
      button.onclick = function (event) {
        event.preventDefault();
        handler();
        return false;
      };
    });
  }

  function showConfirmModal() {
    completeMessage.innerHTML = originalCompleteMessage;
    completeButtons.innerHTML = originalCompleteButtons;
    wireButtons(completeButtons, [
      closeModal,
      function () {
        submitForm();
      }
    ]);
    openModal(completeModal);
  }

  function showSuccessModal(message) {
    completeMessage.textContent = message;
    completeButtons.innerHTML = '<a href="javascript:" class="btn right">확인</a>';
    wireButtons(completeButtons, [
      function () {
        closeModal();
        form.reset();
      }
    ]);
    openModal(completeModal);
  }

  function showErrorModal(message) {
    errorMessage.textContent = message;
    errorButtons.innerHTML = '<a href="javascript:" class="btn right">확인</a>';
    wireButtons(errorButtons, [closeModal]);
    openModal(errorModal);
  }

  function getFieldValue(name) {
    var field = form.querySelector('[name="' + name + '"]');
    return field ? field.value.trim() : "";
  }

  function validateForm() {
    var name = getFieldValue("input_d01d9d5fd9b47");
    var phone1 = getFieldValue("phonenumber1_b00ce8eec8415");
    var phone2 = getFieldValue("phonenumber2_b00ce8eec8415");
    var phone3 = getFieldValue("phonenumber3_b00ce8eec8415");
    var major = getFieldValue("input_9afa498c8b991");
    var privacy = form.querySelector("#privacy input[type='checkbox']");

    if (!name || !phone1 || !phone2 || !phone3 || !major) {
      return {
        ok: false,
        message: "필수 항목을 입력하여 주시기 바랍니다."
      };
    }

    if (!privacy || !privacy.checked) {
      return {
        ok: false,
        message: "개인정보 수집 및 이용에 동의하여 주시기 바랍니다."
      };
    }

    return {
      ok: true,
      name: name,
      phone: [phone1, phone2, phone3].join("-"),
      major: major
    };
  }

  function setBusyState(nextBusy) {
    isSubmitting = nextBusy;
    var trigger = document.querySelector("._input_form_submit");
    if (trigger) {
      trigger.style.pointerEvents = nextBusy ? "none" : "";
      trigger.style.opacity = nextBusy ? "0.65" : "";
    }
  }

  function createUserError(message) {
    var error = new Error(message);
    error.userMessage = message;
    return error;
  }

  function getProvider() {
    return String(config.provider || "formsubmit").toLowerCase();
  }

  function appendCommonFormSubmitFields(payload, validation) {
    payload.append("name", validation.name);
    payload.append("phone", validation.phone);
    payload.append("major", validation.major);
    payload.append("privacy_agreed", "Y");
    payload.append("page_url", window.location.href);
    payload.append("_subject", (config.subjectPrefix + " " + validation.name).trim());
    payload.append("_template", "table");
    payload.append("_captcha", "false");
    payload.append("_honey", "");
  }

  function appendWeb3FormsFields(payload, validation) {
    var accessKey = config.accessKey || config.web3FormsAccessKey || "";
    var endpointContainsKey = /\/submit\/[^/?#]+/i.test(String(config.endpoint || ""));

    if (!accessKey && !endpointContainsKey) {
      throw createUserError(config.missingConfigMessage);
    }

    if (accessKey) {
      payload.append("access_key", accessKey);
    }

    payload.append("subject", (config.subjectPrefix + " " + validation.name).trim());
    payload.append("from_name", config.fromName || "049GAN");
    payload.append("name", validation.name);
    payload.append("phone", validation.phone);
    payload.append("major", validation.major);
    payload.append("privacy_agreed", "Y");
    payload.append("page_url", window.location.href);
    payload.append(
      "message",
      [
        "성함: " + validation.name,
        "연락처: " + validation.phone,
        "전공과목: " + validation.major,
        "접수 페이지: " + window.location.href
      ].join("\n")
    );
    payload.append("botcheck", "");
  }

  function buildRequest(validation) {
    var endpoint = String(config.endpoint || "").trim();
    if (!endpoint) {
      throw createUserError(config.missingConfigMessage);
    }

    var provider = getProvider();
    var payload = new FormData();

    if (provider === "web3forms") {
      appendWeb3FormsFields(payload, validation);
    } else {
      appendCommonFormSubmitFields(payload, validation);
    }

    return {
      url: endpoint,
      options: {
        method: "POST",
        headers: {
          Accept: "application/json"
        },
        body: payload
      }
    };
  }

  async function fetchWithTimeout(url, options) {
    var timeoutMs = Number(config.requestTimeoutMs || 0);
    var controller = typeof AbortController === "function" ? new AbortController() : null;
    var timeoutId = null;
    var requestOptions = Object.assign({}, options);

    if (controller) {
      requestOptions.signal = controller.signal;
    }

    if (controller && timeoutMs > 0) {
      timeoutId = window.setTimeout(function () {
        controller.abort();
      }, timeoutMs);
    }

    try {
      return await fetch(url, requestOptions);
    } finally {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    }
  }

  async function readResponse(response) {
    var text = await response.text();
    if (!text) {
      return {};
    }

    try {
      return JSON.parse(text);
    } catch (error) {
      return { message: text };
    }
  }

  function getResultMessage(result) {
    if (!result || typeof result !== "object") {
      return "";
    }

    if (result.message) {
      return result.message;
    }

    if (result.msg) {
      return result.msg;
    }

    if (result.body && result.body.message) {
      return result.body.message;
    }

    return "";
  }

  function isFailedResult(result) {
    if (!result || typeof result !== "object") {
      return false;
    }

    return result.success === false ||
      result.success === "false" ||
      result.status === "error" ||
      result.error;
  }

  function getErrorMessage(error) {
    if (error && error.userMessage) {
      return error.userMessage;
    }

    if (error && (error.name === "AbortError" || error.message === "Failed to fetch")) {
      return config.networkErrorMessage;
    }

    return error && error.message ? error.message : config.fallbackErrorMessage;
  }

  async function submitForm() {
    var validation = validateForm();
    if (!validation.ok) {
      showErrorModal(validation.message);
      return false;
    }

    if (isSubmitting) {
      return false;
    }

    setBusyState(true);

    try {
      var request = buildRequest(validation);
      var response = await fetchWithTimeout(request.url, request.options);
      var result = await readResponse(response);

      if (!response.ok || isFailedResult(result)) {
        throw new Error(getResultMessage(result) || config.fallbackErrorMessage);
      }

      showSuccessModal(config.successMessage);
    } catch (error) {
      showErrorModal(getErrorMessage(error));
    } finally {
      setBusyState(false);
    }

    return false;
  }

  window.SITE_FORM.confirmInputForm = function (targetWidgetCode, modifyPermit) {
    if (targetWidgetCode !== widgetCode && originalConfirmInputForm) {
      return originalConfirmInputForm(targetWidgetCode, modifyPermit);
    }

    var validation = validateForm();
    if (!validation.ok) {
      showErrorModal(validation.message);
      return false;
    }

    showConfirmModal();
    return false;
  };

  window.SITE_FORM.submit = function (targetWidgetCode) {
    if (targetWidgetCode !== widgetCode && originalSubmit) {
      return originalSubmit(targetWidgetCode);
    }
    return submitForm();
  };

  window.SITE_FORM.hideModal = closeModal;
})();
