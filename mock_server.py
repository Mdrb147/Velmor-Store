#!/usr/bin/env python3
"""
VELMOR STORE - Local Development & Preview Mock Server
Run this script to preview the storefront locally with live mock data:
    python mock_server.py
"""

import http.server
import json
import os
import socketserver
import sys
import webbrowser
from pathlib import Path

PORT = 8000
DIRECTORY = Path(__file__).resolve().parent

MOCK_CATALOG = {
    "ok": True,
    "settings": {
        "store_name": "VELMOR",
        "announcement": "كل أدواتك الرقمية، في مكان واحد — استلام فوري وضمان كامل ↗",
        "hero_title": "اشتراكاتك الرقمية.\nكلها في مكان واحد.",
        "hero_description": "اختر اشتراكك، راجع التفاصيل، واشتري مباشرة. طلباتك وبيانات التفعيل محفوظة في حسابك.",
        "footer_text": "مساحة واحدة لكل اختياراتك الرقمية.",
        "accent": "#758dff",
        "support_url": "https://t.me/VelmorSupport",
        "privacy": "نلتزم بحماية خصوصية بياناتك وتشفيرها بالكامل.",
        "terms": "جميع الاشتراكات أصلية ومشمولة بالضمان طوال مدة الاشتراك.",
        "refund": "ضمان استرجاع أو استبدال في حال وجود أي مشكلة لم يتم حلها خلال 24 ساعة."
    },
    "categories": [
        {"id": 1, "name_ar": "الذكاء الاصطناعي", "name_en": "AI Tools"},
        {"id": 2, "name_ar": "التصميم والمونتاج", "name_en": "Design & Creative"},
        {"id": 3, "name_ar": "الإنتاجية والأعمال", "name_en": "Productivity"}
    ],
    "products": [
        {
            "id": 101,
            "category_id": 1,
            "category_name": "الذكاء الاصطناعي",
            "name_ar": "ChatGPT Plus (GPT-4o)",
            "name_en": "ChatGPT Plus",
            "description": "اشتراك شات جي بي تي بلس الأصلي مع إمكانية الوصول إلى GPT-4o، توليد الصور DALL-E، والتحليل المتقدم للبيانات.",
            "price": 450,
            "is_sold_out": False,
            "delivery_label": "تفعيل على إيميلك الخاص",
            "duration": "شهر كامل (30 يوم)",
            "warranty": "ضمان كامل المدة",
            "badge": "الأكثر مبيعًا 🔥",
            "image_url": "/assets/brands/chatgpt.webp",
            "brand": "OpenAI",
            "brand_color": "#10a37f",
            "min_quantity": 1,
            "max_quantity": 5,
            "sort_order": 1,
            "buyer_prompt": "أدخل بريدك الإلكتروني في OpenAI لتفعيل الاشتراك",
            "buyer_prompt_expects": "email"
        },
        {
            "id": 102,
            "category_id": 1,
            "category_name": "الذكاء الاصطناعي",
            "name_ar": "Claude Pro (Sonnet 3.5)",
            "name_en": "Claude Pro",
            "description": "اشتراك كلاود برو مع وصول غير محدود إلى Claude 3.5 Sonnet لكتابة الأكواد والتحليلات العميقة.",
            "price": 480,
            "is_sold_out": False,
            "delivery_label": "تسليم فوري",
            "duration": "شهر كامل",
            "warranty": "ضمان كامل المدة",
            "badge": "موصى به للمبرمجين",
            "image_url": "/assets/brands/claude.png",
            "brand": "Anthropic",
            "brand_color": "#d97757",
            "min_quantity": 1,
            "max_quantity": 3,
            "sort_order": 2,
            "buyer_prompt": "",
            "buyer_prompt_expects": ""
        },
        {
            "id": 201,
            "category_id": 2,
            "category_name": "التصميم والمونتاج",
            "name_ar": "Canva Pro — كانفا برو",
            "name_en": "Canva Pro",
            "description": "اشتراك كانفا برو على إيميلك الشخصي بمزايا كاملة: تحميل بدون خلفية، ملايين القوالب والخطوط والصور الاحترافية.",
            "price": 120,
            "is_sold_out": False,
            "delivery_label": "تفعيل على إيميلك",
            "duration": "سنة كاملة (12 شهر)",
            "warranty": "ضمان سنوي كامل",
            "badge": "عرض خاص ⚡",
            "image_url": "/assets/brands/canva.png",
            "brand": "Canva",
            "brand_color": "#00c4cc",
            "min_quantity": 1,
            "max_quantity": 5,
            "sort_order": 3,
            "buyer_prompt": "اكتب إيميل حسابك في كانفا",
            "buyer_prompt_expects": "email"
        },
        {
            "id": 202,
            "category_id": 2,
            "category_name": "التصميم والمونتاج",
            "name_ar": "Adobe Creative Cloud",
            "name_en": "Adobe All Apps",
            "description": "حزمة أدوبي الكاملة لجميع البرامج (فوتوشوب، إليستريتور، بريمير، أفتر إفكتس) مع سعة سحابية 100GB.",
            "price": 650,
            "is_sold_out": False,
            "delivery_label": "تفعيل على إيميلك",
            "duration": "3 أشهر",
            "warranty": "ضمان كامل المدة",
            "badge": "شامل كل التطبيقات",
            "image_url": "/assets/brands/adobe.svg",
            "brand": "Adobe",
            "brand_color": "#ff0000",
            "min_quantity": 1,
            "max_quantity": 2,
            "sort_order": 4,
            "buyer_prompt": "إيميل حساب أدوبي",
            "buyer_prompt_expects": "email"
        },
        {
            "id": 301,
            "category_id": 3,
            "category_name": "الإنتاجية والأعمال",
            "name_ar": "Microsoft 365 + 1TB OneDrive",
            "name_en": "Microsoft 365",
            "description": "حزمة أوفيس الأصلية الرسمية (Word, Excel, PowerPoint) مع مساحة تخزين سحابية 1 تيرا بايت على ون درايف.",
            "price": 220,
            "is_sold_out": False,
            "delivery_label": "تسليم فوري",
            "duration": "سنة كاملة",
            "warranty": "ضمان رسمي 12 شهر",
            "badge": "1TB سحابي ☁️",
            "image_url": "/assets/brands/microsoft-365.png",
            "brand": "Microsoft",
            "brand_color": "#0078d4",
            "min_quantity": 1,
            "max_quantity": 5,
            "sort_order": 5,
            "buyer_prompt": "",
            "buyer_prompt_expects": ""
        }
    ],
    "payment_methods": [
        {"id": 1, "name": "فودافون كاش / إنستاباي", "instructions": "<p>حول المبلغ على الرقم: <b>010XXXXXXXX</b><br>ثم اكتب رقم العملية أو ارفع صورة الإيصال.</p>"},
        {"id": 2, "name": "Binance Pay / USDT", "instructions": "<p>Binance Pay ID: <b>12345678</b><br>أو على شبكة TRC20 / BEP20.</p>"}
    ]
}

MOCK_SESSION = {
    "ok": True,
    "user": {
        "id": "mock-user-1",
        "name": "أحمد علي",
        "email": "dev@velmorstore.online",
        "balance": 1500.0,
        "role": "customer",
        "telegram_linked": False
    },
    "csrf": "mock-csrf-token-xyz"
}


class MockStoreHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DIRECTORY), **kwargs)

    def do_GET(self):
        url_path = self.path.split("?")[0]
        if url_path == "/api/catalog":
            return self._send_json(MOCK_CATALOG)
        elif url_path == "/api/session":
            return self._send_json(MOCK_SESSION)
        elif url_path == "/api/payment-quote":
            return self._send_json({
                "ok": True,
                "payment_amounts": {
                    "1": {"amount": "450", "currency": "ج.م", "eligible": True, "minimum": "10"},
                    "2": {"amount": "9.2", "currency": "USDT", "eligible": True, "minimum": "1"}
                }
            })
        elif url_path == "/api/orders":
            return self._send_json({
                "ok": True,
                "orders": [
                    {
                        "id": "VEL-98214",
                        "title": "ChatGPT Plus (GPT-4o) × 1",
                        "status": "delivered",
                        "total": 450,
                        "created": 1757640000,
                        "items": [{"name": "ChatGPT Plus", "quantity": 1}],
                        "deliveries": [{"product_title": "ChatGPT Plus", "payload": "Email: user@example.com\nStatus: Activated"}]
                    }
                ]
            })
        elif url_path == "/api/recharges":
            return self._send_json({"ok": True, "recharges": []})
        elif url_path == "/api/tickets":
            return self._send_json({"ok": True, "tickets": []})
        elif url_path == "/admin" or url_path == "/admin/":
            self.path = "/admin.html"
            return super().do_GET()
        elif url_path == "/checkout" or url_path == "/checkout/":
            self.path = "/checkout.html"
            return super().do_GET()
        elif url_path == "/":
            self.path = "/index.html"
            return super().do_GET()
        return super().do_GET()

    def do_POST(self):
        url_path = self.path.split("?")[0]
        if url_path == "/api/quote":
            return self._send_json({
                "ok": True,
                "items": [{"id": 101, "name": "ChatGPT Plus (GPT-4o)", "quantity": 1, "total": 450, "buyer_prompt": "أدخل بريدك الإلكتروني", "buyer_prompt_expects": "email"}],
                "discount": 0,
                "total": 450,
                "estimates": {"sar": 33.8, "usd": 9.0},
                "payment_amounts": {
                    1: {"amount": "450", "currency": "ج.م", "eligible": True},
                    2: {"amount": "9.2", "currency": "USDT", "eligible": True}
                }
            })
        elif url_path in ("/api/orders", "/api/recharges", "/api/tickets", "/api/profile", "/api/password", "/api/auth/login"):
            return self._send_json({"ok": True, "order": {"id": "VEL-MOCK-999"}, "user": MOCK_SESSION["user"]})
        return self._send_json({"ok": True})

    def _send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        # Clean terminal logging
        sys.stderr.write(f"[MockServer] {self.address_string()} - {format % args}\n")


if __name__ == "__main__":
    os.chdir(DIRECTORY)
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), MockStoreHandler) as httpd:
        url = f"http://localhost:{PORT}"
        print("=" * 60)
        print("[*] VELMOR STORE Local Development Server Running!")
        print(f"[*] Local URL: {url}")
        print("Press Ctrl+C to stop the server.")
        print("=" * 60)
        try:
            webbrowser.open(url)
        except Exception:
            pass
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server.")
