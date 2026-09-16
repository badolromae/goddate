// ============================================
//  설정 파일 — 이 파일만 고치면 됩니다!
//  ============================================
//
//  1) 네이버 카페 주소를 넣으세요.
//  2) Firebase를 만들었다면 firebase 정보를 넣으세요.
//     (아직 없으면 그대로 두세요 → 데모 화면이 나옵니다)
//
// ============================================

window.APP_CONFIG = {

  // ▼ 네이버 카페 주소 (소통 버튼이 여기로 연결돼요)
  cafeUrl: "https://cafe.naver.com/goddate",

  // ▼ 앱 하단에 보이는 문구 (원하는 대로 바꾸세요)
  footerText: "갓 데 이 트 💙",

  // ▼ Firebase 설정
  //    Firebase 콘솔 → 프로젝트 설정 → '내 앱'에서 복사한 값을 넣으세요.
  //    아직 안 만들었으면 projectId를 "YOUR_PROJECT_ID" 그대로 두면
  //    데모 데이터로 미리보기가 됩니다.
  firebase: {
    apiKey: "AIzaSyAypw8v_cwI0gnq4U08t9Ohn2u3kHLODhQ",
    aauthDomain: "goddate-22f2d.firebaseapp.com",
    projectId: "goddate-22f2d",
    storageBucket: "goddate-22f2d.firebasestorage.app",
    messagingSenderId: "77005464708",
    appId: "1:77005464708:web:87dd5ec0812de8213f4ed1"
  },
};
