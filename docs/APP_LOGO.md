# Logo ứng dụng Trích xuất hóa đơn

Ngày thiết kế: 07/10/2026. Công cụ: built-in ImageGen qua skill `imagegen`, không dùng CLI/API fallback.

## Ý tưởng và tài nguyên

Tờ hóa đơn xanh chàm với góc gấp, mũi tên trích xuất và bảng dữ liệu xanh ngọc tạo thành một biểu tượng. Màu chàm gợi sự rõ ràng, tin cậy; xanh ngọc gợi dữ liệu đã được tổ chức. Không thêm chữ để dùng được ở kích thước icon nhỏ. Logo có alpha trong suốt, không có khung bao quanh.

- Master PNG: `static/images/app-logo.png`, 1254×1254 px, RGBA.
- Windows ICO: `static/images/app-icon.ico`, chứa 16, 24, 32, 48, 64, 128, 256 px. Chuyển định dạng/thu nhỏ từ PNG bằng Pillow; giữ nguyên thiết kế và alpha. Các frame ICO dùng BMP 32-bit để tương thích với Windows Forms/System.Drawing; đã đối chiếu icon 32×32 thực tế của cửa sổ với bản ICO.
- Bảng màu yêu cầu: chàm `#303C91`, xanh ngọc `#20B88B`, chi tiết trắng.
- Sử dụng: favicon, logo sidebar và cửa sổ giới thiệu, icon file `.exe`, icon cửa sổ Windows. Cấu hình build dùng icon mới; `webview.start(icon=...)` nạp icon khi chạy mã nguồn hoặc bản đóng gói. AppUserModelID trên Windows: `MinhTrietEras.TrichXuatHoaDon`.
- Logo tác giả `static/images/logo.png` vẫn dùng cho dòng “powered by” và phần nhận diện tác giả. Logo cũ không bị ghi đè.

## Prompt đã sử dụng

```text
Use case: logo-brand. Asset type: production application logo and Windows desktop icon for a Vietnamese offline invoice extraction app called Trích xuất hóa đơn. Create ONE polished original icon-only brand mark on a truly transparent background, square composition, straight-on flat vector-like geometry. Communicate conversion of an electronic invoice into organized spreadsheet data. Primary silhouette: a strong deep indigo invoice document with a folded upper-right corner and two generously spaced short white negative-space horizontal invoice lines in its upper half. A compact emerald/teal spreadsheet-data panel overlaps the document's lower-right area, with an unmistakable minimal 2-by-2 grid; subtly integrate a single simple rightward extraction arrow into the join between paper and data, without clutter. The paper and data panel must read as one balanced cohesive distinctive mark, with bold shapes, clean smooth edges, carefully consistent curves, generous negative space and no fragile thin strokes, legible at 16 and 32 pixel sizes. Color palette: deep indigo #303C91 and emerald teal #20B88B with white negative-space details, restrained subtle tonal variation only if it improves polish. Center the single mark and let it occupy about 85 percent of the square canvas, with transparent padding. No outer rounded-square tile or enclosing card, no white rectangular background, no cast shadow, no glow, no texture, no mockup or scene. No letters, no words, no app name, no currency text, no numbers, no watermark, no Microsoft or Excel letter X, no additional badges, no alternate options. Deliver a standalone master logo suitable for PNG export and multi-size Windows ICO conversion.
```

![Logo ứng dụng](../static/images/app-logo.png)
