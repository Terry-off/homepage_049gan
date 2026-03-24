(function () {
  var form = document.getElementById("addFormw202208048cd9c0bc005d8");
  if (!form || !window.SITE_FORM) {
    return;
  }

  var widgetCode = form.id.replace(/^addForm/, "");
  var config = Object.assign(
    {
      endpoint: "https://formsubmit.co/ajax/hsptool@naver.com",
      successMessage: "문의가 정상 접수되었습니다. 확인 후 연락드리겠습니다.",
      subjectPrefix: "[049GAN CONTACT]",
      fallbackErrorMessage: "문의 전송 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."
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
      var payload = new FormData();
      payload.append("name", validation.name);
      payload.append("phone", validation.phone);
      payload.append("major", validation.major);
      payload.append("privacy_agreed", "Y");
      payload.append("page_url", window.location.href);
      payload.append("_subject", (config.subjectPrefix + " " + validation.name).trim());
      payload.append("_template", "table");
      payload.append("_captcha", "false");
      payload.append("_honey", "");

      var response = await fetch(config.endpoint, {
        method: "POST",
        headers: {
          Accept: "application/json"
        },
        body: payload
      });

      var result = {};
      try {
        result = await response.json();
      } catch (error) {
        result = {};
      }

      if (!response.ok || result.success === "false" || result.success === false) {
        throw new Error(result.message || config.fallbackErrorMessage);
      }

      showSuccessModal(config.successMessage);
    } catch (error) {
      showErrorModal(error && error.message ? error.message : config.fallbackErrorMessage);
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
