/**
 * test_lcd.ino
 * 
 * Chương trình test nhanh màn hình LCD 1602 I2C trên board ESP32-S3
 * Chân kết nối theo sơ đồ nguyên lý:
 *   - LCD_SDA -> GPIO10 (Physical Pin 16)
 *   - LCD_SCL -> GPIO11 (Physical Pin 17)
 */

#include <Wire.h>
#include "src/LiquidCrystal_I2C/LiquidCrystal_I2C.h"

// Định nghĩa chân I2C cho LCD
#define LCD_SDA 10
#define LCD_SCL 11

// Khởi tạo LCD với địa chỉ I2C 0x27, 16 cột, 2 dòng
LiquidCrystal_I2C lcd(0x27, 16, 2);

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("--- Bat dau test LCD ---");

  // Khởi tạo I2C cho LCD
  Serial.printf("Khoi tao I2C LCD: SDA -> GPIO%d, SCL -> GPIO%d\n", LCD_SDA, LCD_SCL);
  Wire.begin(LCD_SDA, LCD_SCL);

  // Khởi tạo LCD
  lcd.init();
  Wire.begin(LCD_SDA, LCD_SCL); // Đảm bảo chân được giữ cấu hình sau khi thư viện init
  lcd.backlight();

  // Hiển thị nội dung test ban đầu
  lcd.setCursor(0, 0);
  lcd.print("LCD Test OK!");
  lcd.setCursor(0, 1);
  lcd.print("ESP32-S3 GPIO10");

  Serial.println("Da hien thi chu len LCD");
}

void loop() {
  // Nhấp nháy đèn nền LCD để kiểm tra phần cứng
  lcd.backlight();
  delay(1000);
  lcd.noBacklight();
  delay(1000);
}
