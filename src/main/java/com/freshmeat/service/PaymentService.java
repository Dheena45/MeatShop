package com.freshmeat.service;

import com.freshmeat.entity.Order;
import com.freshmeat.entity.Payment;
import com.freshmeat.enums.PaymentMethod;
import com.freshmeat.enums.PaymentStatus;
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
        Payment payment = paymentRepository.findByOrderId(order.getId())
                .orElseThrow(() -> new RuntimeException("Payment not found for order"));
        payment.setPaymentStatus(PaymentStatus.PAID);
        payment.setPaidAt(LocalDateTime.now());
        return paymentRepository.save(payment);
    }

    public Payment getByOrder(Order order) {
        return paymentRepository.findByOrderId(order.getId()).orElse(null);
    }
}
