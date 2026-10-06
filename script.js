// ===================================================
// 바이브 카페 주문서 및 주문 내역 기능 스크립트 (script.js)
// ===================================================

// --------------------------------------------------
// 0. Supabase 접속 설정 정보
//    - 발급받으신 Project URL과 anon public Key를 여기에 넣어주세요.
// --------------------------------------------------
const SUPABASE_URL = "https://yihnyudslalxffsteagj.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpaG55dWRzbGFseGZmc3RlYWdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyMzY3NzUsImV4cCI6MjEwNjgxMjc3NX0.s4bAi04Uf9oVHnomUx9NzNozMjvcH041eNBlcnHMorc";

// Supabase 클라이언트를 안전하게 생성하는 헬퍼 함수
function createSupabaseInstance() {
  // window.supabase 또는 전역 supabase 객체 탐색
  const sb = (typeof window !== "undefined" && window.supabase)
    ? window.supabase
    : (typeof supabase !== "undefined" ? supabase : null);

  if (!sb) {
    console.warn("Supabase CDN 라이브러리가 아직 로드되지 않았습니다.");
    return null;
  }

  if (
    !SUPABASE_URL ||
    SUPABASE_URL.includes("여기에_") ||
    !SUPABASE_KEY ||
    SUPABASE_KEY.includes("여기에_")
  ) {
    console.warn("⚠️ SUPABASE_URL 또는 SUPABASE_KEY를 script.js 상단에 입력해주세요.");
    return null;
  }

  try {
    return sb.createClient(SUPABASE_URL, SUPABASE_KEY);
  } catch (err) {
    console.error("Supabase 클라이언트 생성 중 오류 발생:", err);
    return null;
  }
}

// 클라이언트 변수 (요구사항: 변수 이름 supabaseClient)
let supabaseClient = createSupabaseInstance();

// 문서(HTML)가 완전히 로드된 후 스크립트를 실행합니다.
document.addEventListener("DOMContentLoaded", () => {
  // --------------------------------------------------
  // 1. 필요한 HTML 요소(DOM) 가져오기
  // --------------------------------------------------
  // [탭 관련 요소]
  const tabOrderBtn = document.getElementById("tabOrderBtn"); // ☕ 주문하기 탭 버튼
  const tabHistoryBtn = document.getElementById("tabHistoryBtn"); // 📋 주문 내역 탭 버튼
  const orderTabContent = document.getElementById("orderTabContent"); // 주문서 탭 영역
  const historyTabContent = document.getElementById("historyTabContent"); // 주문 내역 탭 영역
  const orderCountBadge = document.getElementById("orderCountBadge"); // 주문 건수 배지

  // [주문서 폼 요소]
  const orderForm = document.getElementById("orderForm"); // 주문 폼
  const nameInput = document.getElementById("name"); // 이름 입력 필드
  const phoneInput = document.getElementById("phone"); // 전화번호 입력 필드
  const drinkSelect = document.getElementById("drink"); // 음료 선택 셀렉트박스
  const sizeRadios = document.querySelectorAll('input[name="size"]'); // 사이즈 라디오 버튼들
  const optionCheckboxes = document.querySelectorAll('input[name="option"]'); // 추가 옵션 체크박스들
  const quantityInput = document.getElementById("quantity"); // 수량 입력 필드
  const requestsInput = document.getElementById("requests"); // 요청사항 텍스트에어리어
  const priceValue = document.getElementById("priceValue"); // 금액 숫자 표시 span
  const submitBtn = document.getElementById("submitBtn"); // 주문하기 버튼
  const resetBtn = document.getElementById("resetBtn"); // 다시 작성 버튼
  const orderConfirmation = document.getElementById("orderConfirmation"); // 주문 확인 메시지 영역

  // [주문 내역 관련 요소]
  const orderList = document.getElementById("orderList"); // 주문 내역 카드 목록 컨테이너
  const historySummary = document.getElementById("historySummary"); // 주문 내역 하단 요약 영역
  const totalOrderSummary = document.getElementById("totalOrderSummary"); // 총 주문 금액 및 건수 표시
  const clearAllBtn = document.getElementById("clearAllBtn"); // 내역 모두 지우기 버튼

  // --------------------------------------------------
  // 2. 주문 데이터 관리 변수
  // --------------------------------------------------
  let orders = []; // 접수된 주문 목록을 저장할 배열
  let orderCounter = 1; // 주문번호 카운터 (#1, #2, ...)

  // --------------------------------------------------
  // 3. 탭 메뉴 전환 이벤트 리스너
  // --------------------------------------------------
  // "☕ 주문하기" 탭 클릭 시
  tabOrderBtn.addEventListener("click", () => {
    tabOrderBtn.classList.add("active");
    tabHistoryBtn.classList.remove("active");

    orderTabContent.classList.remove("hidden");
    historyTabContent.classList.add("hidden");
  });

  // "📋 주문 내역" 탭 클릭 시
  tabHistoryBtn.addEventListener("click", () => {
    tabHistoryBtn.classList.add("active");
    tabOrderBtn.classList.remove("active");

    historyTabContent.classList.remove("hidden");
    orderTabContent.classList.add("hidden");

    // 주문 내역 탭을 열 때 목록 최신화
    renderOrders();
  });

  // --------------------------------------------------
  // 4. 총 금액 계산 함수: calculateTotal()
  //    - 음료, 사이즈, 추가옵션, 수량을 합산하여 계산합니다.
  // --------------------------------------------------
  function calculateTotal() {
    // (1) 음료를 아직 고르지 않았으면 0원 표시 후 종료
    if (!drinkSelect.value || drinkSelect.selectedIndex === 0) {
      updatePriceDisplay(0);
      return 0;
    }

    // (2) 선택한 음료 가격 (data-price 속성값)
    const selectedDrinkOption = drinkSelect.options[drinkSelect.selectedIndex];
    const drinkPrice = Number(selectedDrinkOption.dataset.price) || 0;

    // (3) 선택된 사이즈 추가 금액
    const selectedSizeRadio = document.querySelector('input[name="size"]:checked');
    const sizePrice = selectedSizeRadio ? (Number(selectedSizeRadio.dataset.price) || 0) : 0;

    // (4) 선택된 추가 옵션 금액 합산
    let optionPrice = 0;
    const checkedOptions = document.querySelectorAll('input[name="option"]:checked');
    checkedOptions.forEach((checkbox) => {
      optionPrice += Number(checkbox.dataset.price) || 0;
    });

    // (5) 수량 확인 (최소 1잔)
    let quantity = parseInt(quantityInput.value, 10);
    if (isNaN(quantity) || quantity < 1) {
      quantity = 1;
    }

    // (6) 1잔당 금액 = 음료 + 사이즈 + 추가옵션
    const singleCupPrice = drinkPrice + sizePrice + optionPrice;

    // (7) 총 금액 = 1잔당 금액 * 수량
    const totalPrice = singleCupPrice * quantity;

    // 화면에 천 단위 콤마(toLocaleString)를 적용하여 표시
    updatePriceDisplay(totalPrice);

    return totalPrice;
  }

  // 화면의 예상 금액 텍스트를 업데이트하는 보조 함수
  function updatePriceDisplay(amount) {
    if (priceValue) {
      priceValue.textContent = amount.toLocaleString();
    }
  }

  // --------------------------------------------------
  // 5. 실시간 금액 갱신 이벤트 리스너 등록
  // --------------------------------------------------
  drinkSelect.addEventListener("change", calculateTotal);

  sizeRadios.forEach((radio) => {
    radio.addEventListener("change", calculateTotal);
  });

  optionCheckboxes.forEach((checkbox) => {
    checkbox.addEventListener("change", calculateTotal);
  });

  quantityInput.addEventListener("input", calculateTotal);
  quantityInput.addEventListener("change", calculateTotal);

  // --------------------------------------------------
  // 6. 주문 내역 목록 렌더링 함수: renderOrders()
  // --------------------------------------------------
  function renderOrders() {
    // (1) 탭 메뉴 배지에 주문 건수 업데이트
    if (orderCountBadge) {
      orderCountBadge.textContent = orders.length;
    }

    // (2) 기존 목록 화면 초기화 (안전하게 textContent 비우기)
    orderList.textContent = "";

    // (3) 주문 내역이 하나도 없을 때
    if (orders.length === 0) {
      const emptyMessage = document.createElement("div");
      emptyMessage.className = "empty-order-msg";
      emptyMessage.textContent = "아직 주문 내역이 없어요 ☕";
      orderList.appendChild(emptyMessage);

      if (historySummary) {
        historySummary.classList.add("hidden");
      }
      return;
    }

    // (4) 주문 내역이 있을 때는 하단 요약 영역 보이기
    if (historySummary) {
      historySummary.classList.remove("hidden");
    }

    // (5) orders 배열을 순회하며 주문 카드 생성
    orders.forEach((order) => {
      const card = document.createElement("div");
      card.className = "order-card";

      // --- [1줄] 상단 정보(주문번호, 이름, 금액) 및 취소 버튼 ---
      const cardHeader = document.createElement("div");
      cardHeader.className = "order-card-header";

      const titleEl = document.createElement("div");
      titleEl.className = "order-card-title";
      titleEl.textContent = `#${order.id} ${order.name}님 · ${order.totalPrice.toLocaleString()}원`;

      const cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "order-cancel-btn";
      cancelBtn.textContent = "취소";

      cancelBtn.addEventListener("click", () => {
        const isConfirmed = confirm(`주문번호 #${order.id} 주문을 취소하시겠습니까?`);
        if (isConfirmed) {
          orders = orders.filter((item) => item.id !== order.id);
          renderOrders();
        }
      });

      cardHeader.appendChild(titleEl);
      cardHeader.appendChild(cancelBtn);
      card.appendChild(cardHeader);

      // --- [2줄] 메뉴, 사이즈, 옵션, 수량 ---
      const detailEl = document.createElement("div");
      detailEl.className = "order-card-detail";
      const optionText = order.options && order.options.length > 0
        ? ` (${order.options.join(", ")})`
        : "";
      detailEl.textContent = `${order.drink} ${order.size}사이즈${optionText} ${order.quantity}잔`;
      card.appendChild(detailEl);

      // --- [3줄] 요청사항(있을 때만) · 주문 시간 ---
      const metaEl = document.createElement("div");
      metaEl.className = "order-card-meta";
      if (order.requests) {
        metaEl.textContent = `${order.requests} · ${order.time}`;
      } else {
        metaEl.textContent = `${order.time}`;
      }
      card.appendChild(metaEl);

      orderList.appendChild(card);
    });

    // (6) 하단 전체 금액 및 총 건수 계산
    const totalSum = orders.reduce((sum, item) => sum + item.totalPrice, 0);
    if (totalOrderSummary) {
      totalOrderSummary.textContent = `총 주문 금액: ${totalSum.toLocaleString()}원 (${orders.length}건)`;
    }
  }

  // --------------------------------------------------
  // 7. "내역 모두 지우기" 버튼 이벤트
  // --------------------------------------------------
  if (clearAllBtn) {
    clearAllBtn.addEventListener("click", () => {
      if (orders.length === 0) return;

      const isConfirmed = confirm("모든 주문 내역을 삭제하시겠습니까?");
      if (isConfirmed) {
        orders = [];
        renderOrders();
      }
    });
  }

  // --------------------------------------------------
  // 8. 주문하기 (폼 제출) 이벤트 처리: Supabase 저장 연동
  // --------------------------------------------------
  orderForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    // (1) 이름 입력 검증
    const userName = nameInput.value.trim();
    if (!userName) {
      alert("이름을 입력해주세요");
      nameInput.focus();
      return;
    }

    // (2) 음료 선택 검증
    if (!drinkSelect.value || drinkSelect.selectedIndex === 0) {
      alert("음료를 선택해주세요");
      drinkSelect.focus();
      return;
    }

    // (3) 음료 정보 추출 (이름 및 기본 단가)
    const selectedOption = drinkSelect.options[drinkSelect.selectedIndex];
    const drinkName = selectedOption.textContent.replace(/\s*[\d,]+원\s*$/, "").trim();
    const drinkPrice = Number(selectedOption.dataset.price) || 0;

    // (4) 사이즈 이름 추출 (S, M, L)
    const selectedSizeRadio = document.querySelector('input[name="size"]:checked');
    const sizeName = selectedSizeRadio ? selectedSizeRadio.value : "M";

    // (5) 선택된 옵션 목록 추출 (배열)
    const checkedOptions = document.querySelectorAll('input[name="option"]:checked');
    const optionNames = [];
    checkedOptions.forEach((chk) => {
      const label = document.querySelector(`label[for="${chk.id}"]`);
      if (label) {
        const optText = label.textContent.replace(/\s*\+?[\d,]+원\s*$/, "").trim();
        optionNames.push(optText);
      }
    });

    const optionString = optionNames.length > 0 ? ` (${optionNames.join(", ")})` : "";

    // (6) 수량 및 총 금액 계산
    let quantity = parseInt(quantityInput.value, 10);
    if (isNaN(quantity) || quantity < 1) {
      quantity = 1;
    }
    const finalTotal = calculateTotal();

    // (7) 현재 주문 시간 (예: 오후 01:15)
    const orderTime = new Date().toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    // --------------------------------------------------
    // Supabase 데이터베이스 저장 처리
    // --------------------------------------------------
    // 중복 클릭 방지: 저장 중 버튼 비활성화
    submitBtn.disabled = true;
    const originalBtnText = submitBtn.textContent;
    submitBtn.textContent = "주문 저장 중...";

    try {
      // 클라이언트 인스턴스 확인 (없으면 재시도)
      if (!supabaseClient) {
        supabaseClient = createSupabaseInstance();
      }

      let assignedId = orderCounter++;

      // Supabase 설정이 완료되어 있는 경우 실제 DB에 저장
      if (supabaseClient) {
        const { data, error } = await supabaseClient
          .from("cafe_menu03")
          .insert([
            {
              customer_name: userName,              // 고객명
              phone: phoneInput.value.trim(),       // 전화번호
              drink: drinkName,                     // 음료명
              drink_price: drinkPrice,              // 음료 기본 가격 (숫자)
              size: sizeName,                       // 사이즈 (S, M, L)
              options: optionNames,                 // 선택 옵션 (배열)
              quantity: quantity,                   // 수량 (숫자)
              request: requestsInput.value.trim(),  // 요청사항
              total_price: finalTotal,              // 총 주문 금액 (숫자)
            },
          ])
          .select();

        // Supabase에서 에러를 반환했을 경우 에러 발생
        if (error) {
          throw error;
        }

        // DB에서 생성된 고유 id가 있으면 할당
        if (data && data[0] && data[0].id) {
          assignedId = data[0].id;
        }
      } else {
        // 아직 Supabase URL/KEY를 설정하지 않은 경우
        alert("⚠️ Supabase 접속 키가 아직 입력되지 않았습니다!\nscript.js 상단의 SUPABASE_URL과 SUPABASE_KEY를 입력해주세요.\n(현재 주문은 로컬 화면에만 저장됩니다)");
      }

      // --- [저장 성공 시 동작] ---
      // (1) 로컬 주문 내역에도 추가하여 주문 내역 탭에 즉시 반영
      const newOrder = {
        id: assignedId,
        name: userName,
        phone: phoneInput.value.trim(),
        drink: drinkName,
        size: sizeName,
        options: optionNames,
        quantity: quantity,
        requests: requestsInput.value.trim(),
        totalPrice: finalTotal,
        time: orderTime,
      };
      orders.unshift(newOrder); // 최신 주문이 맨 위에 오도록 추가
      renderOrders(); // 주문 내역 화면 갱신

      // (2) 기존 주문 확인 메시지 표시
      const orderMessage = `${userName}님, ${drinkName} ${sizeName}사이즈${optionString} ${quantity}잔, 총 ${finalTotal.toLocaleString()}원 주문이 접수되었습니다!`;

      orderConfirmation.textContent = orderMessage;
      orderConfirmation.hidden = false;
      orderConfirmation.classList.remove("hidden");

      // 확인 메시지 영역으로 부드럽게 스크롤
      orderConfirmation.scrollIntoView({ behavior: "smooth", block: "nearest" });

    } catch (err) {
      // --- [저장 실패 시 동작] ---
      const errorMsg = err.message || err.error_description || (typeof err === "object" ? JSON.stringify(err) : String(err));
      alert(`주문 저장에 실패했어요\n[상세 내용]: ${errorMsg}`);
      console.error("주문 저장 에러:", err);
    } finally {
      // 저장이 끝나면(성공/실패 무관) 버튼 다시 활성화
      submitBtn.disabled = false;
      submitBtn.textContent = originalBtnText;
    }
  });

  // --------------------------------------------------
  // 9. 다시 작성 버튼 (주문서 초기화)
  // --------------------------------------------------
  orderForm.addEventListener("reset", () => {
    setTimeout(() => {
      const sizeM = document.getElementById("sizeM");
      if (sizeM) {
        sizeM.checked = true;
      }

      if (quantityInput) {
        quantityInput.value = "1";
      }

      if (orderConfirmation) {
        orderConfirmation.textContent = "";
        orderConfirmation.hidden = true;
        orderConfirmation.classList.add("hidden");
      }

      calculateTotal();
    }, 0);
  });

  // --------------------------------------------------
  // 10. 초기 페이지 진입 시 실행
  // --------------------------------------------------
  calculateTotal(); // 초기 금액 (0원)
  renderOrders();   // 초기 주문 내역 (빈 화면 및 배지 0)
});
