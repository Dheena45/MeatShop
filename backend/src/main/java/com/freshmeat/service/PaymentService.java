package com.freshmeat.service;

import com.freshmeat.entity.Order;
import com.freshmeat.entity.Payment;
import com.freshmeat.enums.PaymentMethod;
import com.freshmeat.enums.PaymentStatus;
import com.freshmeat.exception.ConflictException;
import com.freshmeat.repository.PaymentRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Service
public class PaymentService {

    @Autowired
    private PaymentRepository paymentRepository;

    public Payment createPayment(Order order, PaymentMethod method, BigDecimal amount) {
        Payment payment = new Payment();
        payment.setOrder(order);
        payment.setAmount(amount);
        payment.setPaymentMethod(method);
        payment.setPaymentStatus(PaymentStatus.PENDING);

        if (method == PaymentMethod.ONLINE && amount.compareTo(BigDecimal.ZERO) == 0) {
            payment.setPaymentStatus(PaymentStatus.PAID);
            payment.setPaidAt(LocalDateTime.now());
        }

        return paymentRepository.save(payment);
    }

    public Payment markAsPaid(Order order) {
        Payment payment = getByOrder(order);
        if (payment == null) {
            throw new RuntimeException("Payment not found for order");
        }
        payment.setPaymentStatus(PaymentStatus.PAID);
        payment.setPaidAt(LocalDateTime.now());
        return paymentRepository.save(payment);
    }

    public Payment markPaymentReceived(Order order, String transactionRef) {
        Payment payment = getByOrder(order);
        if (payment == null) {
            throw new RuntimeException("Payment not found for order");
        }
        if (payment.getPaymentStatus() == PaymentStatus.PAID) {
            throw new ConflictException(
                    "Payment for this order has already been marked as received.");
        }
        if (payment.getPaymentStatus() == PaymentStatus.CANCELLED) {
            throw new ConflictException(
                    "Payment for this order was cancelled; the order cannot be collected.");
        }
        payment.setPaymentStatus(PaymentStatus.PAID);
        payment.setPaidAt(LocalDateTime.now());
        if (transactionRef != null && !transactionRef.isBlank()) {
            payment.setTransactionRef(transactionRef.trim());
        }
        return paymentRepository.save(payment);
    }

    /**
     * Marks an online payment as PAID after the gateway confirms success.
     * Allowed from PENDING or FAILED (a retried attempt); already-paid and
     * cancelled payments are rejected with a 409 Conflict.
     */
    public Payment markOnlinePaid(Order order, String transactionRef) {
        Payment payment = getByOrder(order);
        if (payment == null) {
            throw new RuntimeException("Payment not found for order");
        }
        if (payment.getPaymentStatus() == PaymentStatus.PAID) {
            throw new ConflictException("This payment has already been completed.");
        }
        if (payment.getPaymentStatus() == PaymentStatus.CANCELLED) {
            throw new ConflictException("This payment was cancelled and cannot be completed.");
        }
        payment.setPaymentStatus(PaymentStatus.PAID);
        payment.setPaidAt(LocalDateTime.now());
        if (transactionRef != null && !transactionRef.isBlank()) {
            payment.setTransactionRef(transactionRef.trim());
        }
        return paymentRepository.save(payment);
    }

    /**
     * Marks an online payment as FAILED when the gateway reports a failed
     * attempt. Only PENDING payments can fail; a PAID payment can never be
     * flipped to FAILED and a repeated failure for an already-failed payment
     * is treated as an idempotent no-op.
     */
    public Payment markOnlineFailed(Order order) {
        Payment payment = getByOrder(order);
        if (payment == null) {
            throw new RuntimeException("Payment not found for order");
        }
        if (payment.getPaymentStatus() == PaymentStatus.PAID) {
            throw new ConflictException("This payment has already been completed and cannot be failed.");
        }
        if (payment.getPaymentStatus() == PaymentStatus.CANCELLED) {
            throw new ConflictException("This payment was cancelled and cannot be failed.");
        }
        if (payment.getPaymentStatus() == PaymentStatus.FAILED) {
            return payment;
        }
        payment.setPaymentStatus(PaymentStatus.FAILED);
        payment.setPaidAt(null);
        return paymentRepository.save(payment);
    }

    public Payment getByOrder(Order order) {
        return paymentRepository.findByOrderId(order.getId()).orElse(null);
    }
}
