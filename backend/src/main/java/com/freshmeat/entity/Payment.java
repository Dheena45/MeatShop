package com.freshmeat.entity;

import com.freshmeat.enums.PaymentMethod;
import com.freshmeat.enums.PaymentStatus;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.AccessType;
import org.springframework.data.annotation.Id;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Payment of an order — <b>embedded</b> inside its {@link Order} document.
 * <p>
 * There is no {@code order} back-reference and no {@code PaymentRepository}
 * anymore: the payment is created, mutated and read as part of the order, in
 * the same save, which is what the MySQL schema's 1:1 constraint was
 * guaranteeing. {@link PaymentService} now goes through
 * {@code OrderRepository}.
 * <p>
 * Id and timestamps are assigned explicitly where the payment is created
 * (embedded objects never pass through the root-document lifecycle callback).
 */
@AccessType(AccessType.Type.FIELD)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Payment {

    @Id
    private Long id;

    private BigDecimal amount;

    private PaymentMethod paymentMethod;

    private PaymentStatus paymentStatus = PaymentStatus.PENDING;

    private String transactionRef;

    private LocalDateTime paidAt;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
