import { authRouter } from "./router/auth";
import { businessRouter } from "./router/business";
import { categoryRouter } from "./router/category";
import { customerRouter } from "./router/customer";
import { expenseRouter } from "./router/expense";
import { helloRouter } from "./router/health_check";
import { paymentRouter } from "./router/payment";
import { productRouter } from "./router/product";
import { reportRouter } from "./router/report";
import { saleRouter } from "./router/sale";
import { stripeRouter } from "./router/stripe";
import { createTRPCRouter } from "./trpc";

export const edgeRouter = createTRPCRouter({
  stripe: stripeRouter,
  hello: helloRouter,
  auth: authRouter,
  customer: customerRouter,
  business: businessRouter,
  category: categoryRouter,
  product: productRouter,
  sale: saleRouter,
  expense: expenseRouter,
  report: reportRouter,
  payment: paymentRouter,
});
