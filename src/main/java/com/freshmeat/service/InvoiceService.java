package com.freshmeat.service;

import com.freshmeat.dto.InvoiceDTO;
import com.freshmeat.dto.InvoiceLineDTO;
import com.freshmeat.entity.Invoice;
import com.freshmeat.entity.Order;
import com.freshmeat.entity.OrderItem;
import com.freshmeat.entity.Product;
import com.freshmeat.exception.ResourceNotFoundException;
import com.freshmeat.repository.InvoiceRepository;
import com.freshmeat.repository.OrderRepository;
import com.lowagie.text.Document;
import com.lowagie.text.DocumentException;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.FontFactory;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Rectangle;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.DecimalFormat;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

@Service
public class InvoiceService {

    private static final Color BRAND = new Color(0x8B, 0x1A, 0x1A);
    private static final Color MUTED = new Color(0x6B, 0x72, 0x80);
    private static final DecimalFormat MONEY = new DecimalFormat("#,##0.00");
    private static final DecimalFormat MONEY_INT = new DecimalFormat("#,##0");
    private static final DateTimeFormatter RECEIPT_DATE_FMT =
            DateTimeFormatter.ofPattern("dd-MM-yyyy");
    private static final DateTimeFormatter RECEIPT_DATE_TIME_FMT =
            DateTimeFormatter.ofPattern("dd-MM-yyyy, hh:mm a");

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private InvoiceRepository invoiceRepository;

    @Autowired
    private ContactSettingsService contactSettingsService;

    @Transactional
    public InvoiceDTO getOrCreate(Long orderId) {
        Invoice invoice = invoiceRepository.findByOrderId(orderId)
                .orElseGet(() -> createInvoice(orderId));
        return toDTO(invoice);
    }

    /**
     * Invoice creation is idempotent per order: the unique order_id constraint
     * guarantees one invoice per order. Number assignment is synchronized so a
     * single application instance never hands out duplicate invoice numbers.
     */
    private synchronized Invoice createInvoice(Long orderId) {
        return invoiceRepository.findByOrderId(orderId)
                .orElseGet(() -> {
                    Order order = orderRepository.findById(orderId)
                            .orElseThrow(() -> new ResourceNotFoundException("Order not found"));
                    Invoice invoice = new Invoice();
                    invoice.setOrder(order);
                    LocalDateTime now = LocalDateTime.now();
                    invoice.setInvoiceDate(now);
                    invoice.setInvoiceNumber(generateInvoiceNumber(now));
                    return invoiceRepository.save(invoice);
                });
    }

    private String generateInvoiceNumber(LocalDateTime date) {
        String prefix = "FM-" + date.getYear() + "-";
        long seq = invoiceRepository.countByInvoiceNumberStartingWith(prefix) + 1;
        return prefix + String.format("%04d", seq);
    }

    @Transactional(readOnly = true)
    public InvoiceDTO toDTO(Invoice invoice) {
        Order order = invoice.getOrder();
        if (order == null) {
            throw new ResourceNotFoundException("Order not found");
        }

        InvoiceDTO dto = new InvoiceDTO();
        dto.setId(invoice.getId());
        dto.setInvoiceNumber(invoice.getInvoiceNumber());
        dto.setInvoiceDate(invoice.getInvoiceDate());
        dto.setOrderId(order.getId());
        dto.setOrderNumber(order.getOrderNumber());
        dto.setOrderDate(order.getCreatedAt());
        dto.setCustomerName(order.getCustomerName());
        dto.setCustomerEmail(order.getUser() != null ? order.getUser().getEmail() : null);
        dto.setCustomerPhone(order.getCustomerPhone());
        dto.setDeliveryDoor(order.getDeliveryDoor());
        dto.setDeliveryStreet(order.getDeliveryStreet());
        dto.setDeliveryArea(order.getDeliveryArea());
        dto.setDeliveryCity(order.getDeliveryCity());
        dto.setDeliveryState(order.getDeliveryState());
        dto.setDeliveryPincode(order.getDeliveryPincode());
        dto.setDeliverySlot(order.getDeliverySlot());
        dto.setNotes(order.getNotes());
        dto.setSubtotal(order.getSubtotal());
        dto.setDiscountAmount(order.getDiscountAmount());
        dto.setDeliveryCharge(order.getDeliveryCharge());
        dto.setTax(order.getTax());
        dto.setGrandTotal(order.getGrandTotal());
        dto.setOrderStatus(order.getStatus() != null ? order.getStatus().name() : null);

        if (order.getPayment() != null) {
            dto.setPaymentMethod(order.getPayment().getPaymentMethod() != null
                    ? order.getPayment().getPaymentMethod().name() : null);
            dto.setPaymentStatus(order.getPayment().getPaymentStatus() != null
                    ? order.getPayment().getPaymentStatus().name() : null);
            dto.setPaidAt(order.getPayment().getPaidAt());
        }

        dto.setStoreName("FreshMeat");
        dto.setStoreTagline("Fresh Cuts. Honest Prices. Delivered Fast.");
        try {
            var contact = contactSettingsService.getSettings();
            dto.setStoreAddress(contact.getAddress());
            dto.setStorePhone(contact.getPhone());
            dto.setStoreEmail(contact.getEmail());
            dto.setStoreHours(contact.getBusinessHours());
        } catch (Exception ignored) {
            // optional branding details; ignore if contact settings unavailable
        }

        for (OrderItem oi : order.getItems()) {
            InvoiceLineDTO line = new InvoiceLineDTO();
            line.setProductName(oi.getProductName());
            line.setCuttingOption(oi.getCuttingOption());
            line.setUnit(unitFor(oi));
            line.setQuantity(oi.getQuantity() != null
                    ? BigDecimal.valueOf(oi.getQuantity()) : BigDecimal.ZERO);
            line.setPricePerKg(oi.getPricePerKg());
            line.setDiscount(lineDiscount(oi));
            line.setSubtotal(oi.getSubtotal());
            dto.getItems().add(line);
        }

        return dto;
    }

    private String unitFor(OrderItem oi) {
        Product product = oi.getProduct();
        if (product != null && product.getUnit() != null && !product.getUnit().isBlank()) {
            return product.getUnit();
        }
        return "KG";
    }

    private BigDecimal lineDiscount(OrderItem oi) {
        Product product = oi.getProduct();
        if (product == null || product.getPricePerKg() == null || oi.getPricePerKg() == null) {
            return BigDecimal.ZERO;
        }
        BigDecimal qty = oi.getQuantity() != null
                ? BigDecimal.valueOf(oi.getQuantity()) : BigDecimal.ZERO;
        BigDecimal original = product.getPricePerKg().multiply(qty);
        BigDecimal paid = oi.getPricePerKg().multiply(qty);
        BigDecimal discount = original.subtract(paid);
        return discount.max(BigDecimal.ZERO);
    }

    @Transactional
    public byte[] generatePdf(Long orderId) {
        InvoiceDTO dto = getOrCreate(orderId);
        return buildPdf(dto);
    }

    private byte[] buildPdf(InvoiceDTO dto) {
        Document document = new Document(new Rectangle(226, 400), 16, 16, 20, 20);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try {
            PdfWriter.getInstance(document, out);
            document.open();

            Paragraph brand = centeredText("FRESHMEAT", 18, Font.BOLD, BRAND);
            document.add(brand);
            Paragraph sub = centeredText("Fresh Meat Shop", 9, Font.NORMAL, MUTED);
            sub.setSpacingAfter(6);
            document.add(sub);
            document.add(receiptLine());

            document.add(kvParagraph("Invoice", nonNull(dto.getInvoiceNumber())));
            document.add(kvParagraph("Order", "#" + nonNull(dto.getOrderNumber())));
            document.add(kvParagraph("Date", fmtReceiptDate(dto.getInvoiceDate())));
            document.add(receiptSpacer(4));

            document.add(kvParagraph("Customer", nonNull(dto.getCustomerName())));
            document.add(kvParagraph("Mobile", nonNull(dto.getCustomerPhone())));
            String address = deliveryAddress(dto);
            if (!address.isBlank()) {
                Paragraph addr = new Paragraph(address, FontFactory.getFont(
                        FontFactory.HELVETICA, 9, Font.NORMAL, new Color(0x37, 0x37, 0x37)));
                addr.setLeading(12);
                document.add(addr);
            }
            document.add(receiptSpacer(2));
            document.add(receiptLine());

            PdfPTable items = new PdfPTable(3);
            items.setWidthPercentage(100);
            items.setWidths(new float[]{4.6f, 1.4f, 1.8f});
            for (InvoiceLineDTO line : dto.getItems()) {
                PdfPCell nameCell = noBorderCell();
                nameCell.addElement(brandedParagraph(
                        line.getProductName() + cuttingSuffix(line.getCuttingOption()),
                        9, Font.BOLD, new Color(0x1F, 0x29, 0x37)));
                items.addCell(nameCell);
                PdfPCell qtyCell = noBorderCell();
                qtyCell.setHorizontalAlignment(Element.ALIGN_RIGHT);
                qtyCell.addElement(brandedParagraph(
                        formatQty(line.getQuantity()) + " " + nonNull(line.getUnit()),
                        9, Font.NORMAL, new Color(0x37, 0x37, 0x37)));
                items.addCell(qtyCell);
                PdfPCell amtCell = noBorderCell();
                amtCell.setHorizontalAlignment(Element.ALIGN_RIGHT);
                amtCell.addElement(brandedParagraph(
                        compactMoney(line.getSubtotal()), 9, Font.NORMAL, new Color(0x37, 0x37, 0x37)));
                items.addCell(amtCell);
            }
            document.add(items);
            document.add(receiptLine());

            document.add(billRow("Subtotal", compactMoney(dto.getSubtotal()), false));
            document.add(billRow("Discount", "-" + compactMoney(dto.getDiscountAmount()), false));
            document.add(billRow("Delivery",
                    isZero(dto.getDeliveryCharge()) ? "FREE" : compactMoney(dto.getDeliveryCharge()), false));
            BigDecimal tax = dto.getTax() == null ? BigDecimal.ZERO : dto.getTax();
            if (tax.compareTo(BigDecimal.ZERO) != 0) {
                document.add(billRow("Tax", compactMoney(tax), false));
            }
            document.add(billRow("TOTAL", compactMoney(dto.getGrandTotal()), true));
            document.add(receiptLine());

            document.add(kvParagraph("Payment", nonNull(dto.getPaymentMethod())));
            document.add(kvParagraph("Status", nonNull(dto.getPaymentStatus())));
            if (dto.getPaidAt() != null) {
                document.add(kvParagraph("Paid On", fmtReceiptDateTime(dto.getPaidAt())));
            }
            document.add(kvParagraph("Order Status", nonNull(dto.getOrderStatus())));
            if (dto.getDeliverySlot() != null && !dto.getDeliverySlot().isBlank()) {
                document.add(kvParagraph("Delivery", dto.getDeliverySlot()));
            }
            if (dto.getNotes() != null && !dto.getNotes().isBlank()) {
                document.add(kvParagraph("Notes", dto.getNotes()));
            }
            document.add(receiptLine());

            Paragraph thanks = centeredText(
                    "Thank you for shopping with FreshMeat!", 10, Font.BOLD, new Color(0x1F, 0x29, 0x37));
            thanks.setSpacingBefore(6);
            document.add(thanks);

            String help = nonNull(dto.getStoreAddress())
                    + (dto.getStorePhone() != null && !dto.getStorePhone().isBlank()
                    ? "  |  " + dto.getStorePhone() : "")
                    + (dto.getStoreEmail() != null && !dto.getStoreEmail().isBlank()
                    ? "  |  " + dto.getStoreEmail() : "");
            Paragraph helpLine = centeredText(help, 8, Font.NORMAL, MUTED);
            helpLine.setSpacingBefore(2);
            document.add(helpLine);

        } catch (DocumentException ex) {
            throw new IllegalStateException("Invoice PDF generation failed", ex);
        } finally {
            document.close();
        }
        return out.toByteArray();
    }

    private Paragraph brandedParagraph(String text, float size, int style, Color color) {
        Paragraph p = new Paragraph(text, FontFactory.getFont(FontFactory.HELVETICA, size, style, color));
        p.setSpacingAfter(2);
        return p;
    }

    private Paragraph kvParagraph(String key, String value) {
        Paragraph p = new Paragraph(key + ": " + value, FontFactory.getFont(
                FontFactory.HELVETICA, 9, Font.NORMAL, new Color(0x37, 0x37, 0x37)));
        p.setSpacingAfter(1);
        return p;
    }

    private Paragraph centeredText(String text, float size, int style, Color color) {
        Paragraph p = new Paragraph(text, FontFactory.getFont(FontFactory.HELVETICA, size, style, color));
        p.setAlignment(Element.ALIGN_CENTER);
        p.setSpacingAfter(2);
        return p;
    }

    private com.lowagie.text.pdf.draw.VerticalPositionMark receiptLine() {
        return new com.lowagie.text.pdf.draw.VerticalPositionMark(
                new DashedLine(new Color(0x99, 0x99, 0x99), 0.5f), 0f);
    }

    /**
     * OpenPDF's LineSeparator has no built-in dash support, so we draw the
     * dashed separator directly on the PDF content stream.
     */
    private static final class DashedLine implements com.lowagie.text.pdf.draw.DrawInterface {
        private final Color color;
        private final float width;

        DashedLine(Color color, float width) {
            this.color = color;
            this.width = width;
        }

        @Override
        public void draw(com.lowagie.text.pdf.PdfContentByte canvas,
                         float xLineStart, float yLineStart,
                         float xLineEnd, float yLineEnd, float currentPosition) {
            canvas.saveState();
            canvas.setLineWidth(width);
            canvas.setColorStroke(color);
            canvas.setLineDash(2f, 2f, 0f);
            canvas.moveTo(xLineStart, currentPosition);
            canvas.lineTo(xLineEnd, currentPosition);
            canvas.stroke();
            canvas.restoreState();
        }
    }

    private PdfPCell noBorderCell() {
        PdfPCell cell = new PdfPCell();
        cell.setBorder(Rectangle.NO_BORDER);
        cell.setPadding(1);
        return cell;
    }

    private PdfPTable billRow(String label, String value, boolean emphasized) {
        PdfPTable table = new PdfPTable(2);
        table.setWidthPercentage(100);
        Color color = emphasized ? BRAND : new Color(0x37, 0x37, 0x37);
        PdfPCell left = noBorderCell();
        left.addElement(brandedParagraph(label, emphasized ? 10 : 9,
                emphasized ? Font.BOLD : Font.NORMAL, color));
        PdfPCell right = noBorderCell();
        right.setHorizontalAlignment(Element.ALIGN_RIGHT);
        right.addElement(brandedParagraph(value, emphasized ? 11 : 9,
                emphasized ? Font.BOLD : Font.NORMAL, color));
        table.addCell(left);
        table.addCell(right);
        return table;
    }

    private Paragraph receiptSpacer(float leading) {
        Paragraph p = new Paragraph(" ", FontFactory.getFont(FontFactory.HELVETICA, 2));
        p.setLeading(leading);
        return p;
    }

    private String cuttingSuffix(String cuttingOption) {
        return cuttingOption == null || cuttingOption.isBlank()
                ? "" : "  (" + cuttingOption.replace("_", " ") + ")";
    }

    private String deliveryAddress(InvoiceDTO dto) {
        StringBuilder sb = new StringBuilder();
        if (nonNull(dto.getDeliveryDoor()).isBlank() && nonNull(dto.getDeliveryArea()).isBlank()) {
            return "";
        }
        String[] parts = {
                dto.getDeliveryDoor(), dto.getDeliveryStreet(), dto.getDeliveryArea(),
                dto.getDeliveryCity()
                        + (dto.getDeliveryPincode() != null && !dto.getDeliveryPincode().isBlank()
                        ? " - " + dto.getDeliveryPincode() : ""),
                dto.getDeliveryState()
        };
        for (String part : parts) {
            if (part != null && !part.isBlank()) {
                sb.append(part).append(", ");
            }
        }
        String address = sb.toString();
        if (address.endsWith(", ")) {
            address = address.substring(0, address.length() - 2);
        }
        return "\nDeliver To:\n" + address;
    }

    private String formatQty(BigDecimal qty) {
        if (qty == null) return "0";
        return qty.stripTrailingZeros().toPlainString();
    }

    private String compactMoney(BigDecimal value) {
        if (value == null) return "Rs. 0";
        BigDecimal scaled = value.setScale(2, RoundingMode.HALF_UP);
        if (scaled.setScale(0, RoundingMode.DOWN).compareTo(scaled) == 0) {
            return "Rs. " + MONEY_INT.format(scaled.setScale(0));
        }
        return "Rs. " + MONEY.format(scaled);
    }

    private boolean isZero(BigDecimal value) {
        return value == null || value.compareTo(BigDecimal.ZERO) == 0;
    }

    private String fmtReceiptDate(LocalDateTime dateTime) {
        return dateTime == null ? "-" : dateTime.format(RECEIPT_DATE_FMT);
    }

    private String fmtReceiptDateTime(LocalDateTime dateTime) {
        return dateTime == null ? "-" : dateTime.format(RECEIPT_DATE_TIME_FMT);
    }

    private String nonNull(String value) {
        return value == null ? "" : value;
    }
}