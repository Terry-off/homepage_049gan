# Section Map

원본 기준 상단부터 하단까지의 화면 구조입니다.

1. Header
   데스크톱 오버레이 헤더, 모바일 상단 바, HOME/ABOUT/MARKETING/CONTACT 네비게이션, 우측 SNS 바로가기.
2. Hero Visual
   복도 비주얼 배경 위에 타이틀 카피가 중앙 정렬되는 첫 화면.
3. Intro 01
   `나도 개원할 수 있을까?` 질문형 카피와 GIF/텍스트 블록.
4. Intro 02
   어두운 배경과 `개원 그냥 해도 됩니다.` 메시지, 문제 제기형 카피 전개.
5. Reason Title
   `우리의 평범한 이유 3가지` 타이틀 섹션.
6. Real Talk
   업계 현실 설명, 원형 이미지 카드 3개, 다크 배경 섹션.
7. We Say
   병원 생존/투명성 메시지와 장문 카피 블록.
8. Experience & Data
   통계/수치/입지 메시지, 다크 배경, 데이터 중심 설명 섹션.
9. Gallery / Article
   성공 병원 이미지 슬라이드와 기사형 콘텐츠 블록.
10. Revenue Message
   `결국, 수익을 말해야 합니다` 메시지와 이미지 조합.
11. Closing Statement
   `원장님은 치료의 경험을 쌓았습니다` 카피 전개.
12. Newsletter
   이메일 입력, 구독 버튼, 프라이빗 뉴스레터 안내.
13. Promo Cards
   PDF 책자 안내, 요즘 잘나가는 병원은? 콘텐츠 카드.
14. Footer
   브랜드 문구, 사업자 정보, 주소, 약관/개인정보처리방침, SNS 링크.

## Responsive Behavior

- 데스크톱: 헤더 오버레이 상태에서 시작하고, visual section을 기준으로 메뉴 컬러와 active underline이 유지됩니다.
- 태블릿/모바일: 상단 바와 메뉴 버튼, 검색 버튼, 1차 메뉴가 고정되고 첫 화면 타이틀 크기와 위치가 모바일 규칙으로 바뀝니다.
- 섹션 간 여백, 다크/라이트 전환, 이미지/GIF 등장 방식은 원본 DOM과 CSS 규칙을 그대로 따릅니다.
