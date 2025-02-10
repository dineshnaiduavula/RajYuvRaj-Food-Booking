import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, updateDoc, doc, onSnapshot, addDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Printer, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { playNotificationSound } from '../../utils/sound';
import { calculateTaxes } from '../../utils/calculateTaxes';
import axios from 'axios';
import { usePaymentStore } from '../../store/paymentStore';
interface Order {
  id: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  total: number;
  customerName: string;
  customerPhone: string;
  seatNumber: string;
  status: string;
  createdAt: string;
  screen: string;
}

function OrderManagement() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [previousOrderCount, setPreviousOrderCount] = useState(0);
  const { checkPaymentStatus} = usePaymentStore();

  useEffect(() => {
    let isFirstRender = true;
//code
const checkAndUpdatePayments = async () => {
  const ordersRef = collection(db, 'transactions');
  const snapshot = await getDocs(ordersRef);

  snapshot.forEach(async (order) => {
    const data = order.data();
    
    if (data.status === 'pending') {
     const result = await checkPaymentStatus(data.orderId);
      if (result.success) {
        await addDoc(collection(db, 'orders'), {
          items: data.items,
          total: data.amount,
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          seatNumber:data.seatNumber,
          status: 'success',
          screen:data.screen,
          orderId: result.razorpay_order_id,
          paymentId: result.razorpay_payment_id,
          signature: result.razorpay_signature,
          createdAt: new Date().toISOString()
        });
        await updateDoc(doc(db, 'transactions', order.id), {
          status: 'success',
          verified: true,
          updatedAt: new Date().toISOString() });
      }
       else {
        console.log(`Payment still pending for order: ${order.id}`);}
    }
  })
};
checkAndUpdatePayments()

    const q = query(
      collection(db, 'orders'),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedOrders: Order[] = [];
      snapshot.forEach((doc) => {
        fetchedOrders.push({ id: doc.id, ...doc.data() } as Order);
      });
      
      const sortedOrders = fetchedOrders.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      if (!isFirstRender && sortedOrders.length > previousOrderCount) {
        playNotificationSound();
      }
      isFirstRender = false;
      setPreviousOrderCount(sortedOrders.length);
      setOrders(sortedOrders);
    }, (error) => {
      toast.error('Failed to fetch orders');
      console.error('Error fetching orders:', error);
    });

    return () => unsubscribe();
  }, [previousOrderCount]);

  const handlePrint = (order: Order) => {
    const subtotal = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const { sgst, cgst, handlingCharges } = calculateTaxes(subtotal);
    
    const printContent = `
      ---------------------------------
                Customer Copy
                G3 CINEMA
      ---------------------------------
      Completed At: ${new Date(order.createdAt).toLocaleString()}
      GSTN :37AAKFV0150G1Z9

      Order Details:
      ---------------------------------
      Customer Name  : ${order.customerName}
      Seat Number    : ${order.seatNumber}
      Screen         : ${order.screen}
      Phone Number   : ${order.customerPhone}
      ---------------------------------
      Items:
      ---------------------------------
      ${String(`Item Name`).padEnd(15) + String(`Qty`).padEnd(5) + String(`Price`)}
${order.items
  .map(
    (item) =>
      `      ${item.name.padEnd(15)} x${item.quantity}  ₹${(
        item.price * item.quantity
      ).toFixed(2)}`
  )
  .join('\n')}
      ---------------------------------
      Sub Total            :₹ ${subtotal.toFixed(2)}
      ---------------------------------
      Handling Charges(4%) : ₹${handlingCharges.toFixed(2)}
      ---------------------------------
      Total Amount   : ₹${order.total.toFixed(2)}
      ---------------------------------
      Thank You for Choosing G3 Cinema!
`;


  //   const printContent = `
  //   Customer Copy
  //   G3 CINEMA
  // ------------------
  //   Order Details:
  //   Customer: ${order.customerName}
  //   Seat: ${order.seatNumber}
  //   Screen: ${order.screen}
  //   Phone: ${order.customerPhone}
    
  //   Items:
  //   ${order.items.map(item => `${item.name} x${item.quantity} - ₹${item.price * item.quantity}`).join('\n')}
    
    
    
  //   Total: ₹${order.total.toFixed(2)}
  // `;

    // Subtotal: ₹${subtotal.toFixed(2)}
    //   SGST (2.5%): ₹${sgst.toFixed(2)}
    //   CGST (2.5%): ₹${cgst.toFixed(2)}
    //   Handling Charges (4%): ₹${handlingCharges.toFixed(2)}
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`<pre>${printContent}</pre>`);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const updateOrderStatus = async (orderId: string, status: 'completed' | 'not_done') => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status,
        completedAt: new Date().toISOString(),
        completionStatus: status === 'completed' ? 'success' : 'failed'
      });
      toast.success(`Order marked as ${status === 'completed' ? 'completed' : 'not done'}`);
    } catch (error) {
      toast.error('Failed to update order status');
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Active Orders</h2>
      
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {orders.map((order) => {
          const subtotal = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
          const { sgst, cgst, handlingCharges } = calculateTaxes(subtotal);
          
          return (
            <div key={order.id} className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {order.customerName}
                  </h3>
                  <p className="text-sm text-gray-500">Seat: {order.seatNumber}</p>
                  <p className="text-sm text-gray-500">Screen: {order.screen}</p>
                  <p className="text-sm text-gray-500">Phone: {order.customerPhone}</p>
                </div>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                  Pending
                </span>
              </div>
              
              <div className="border-t border-b py-4 my-4">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Order Items:</h4>
                <div className="space-y-2">
                  {order.items.map((item, index) => (
                    <div key={index} className="flex justify-between text-sm">
                      <span>{item.name} x{item.quantity}</span>
                      <span>₹{(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t space-y-2">
                   <div className="flex justify-between text-sm">
                    <span>Subtotal</span>
                    <span>₹{subtotal.toFixed(2)}</span>
                  </div>
                  {/* <div className="flex justify-between text-sm">
                    <span>SGST (2.5%)</span>
                    <span>₹{sgst.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>CGST (2.5%)</span>
                    <span>₹{cgst.toFixed(2)}</span>
                  </div> */}
                  <div className="flex justify-between text-sm">
                    <span>Handling Charges (4%)</span>
                    <span>₹{handlingCharges.toFixed(2)}</span>
                  </div> 
                  <div className="flex justify-between font-medium pt-2 border-t ">
                  {/* border-t */}
                    <span>Total</span>
                    <span>₹{order.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => handlePrint(order)}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Printer className="w-4 h-4 mr-2" />
                  Print
                </button>
                {/* <button
                  onClick={() => updateOrderStatus(order.id, 'not_done')}
                  className="inline-flex items-center px-3 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-purple-600 hover:bg-purple-700"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Not Done
                </button> */}
                <button
                  onClick={() => updateOrderStatus(order.id, 'completed')}
                  className="inline-flex items-center px-3 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Mark as Done
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {orders.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No pending orders</p>
        </div>
      )}
    </div>
  );
}

export default OrderManagement;
