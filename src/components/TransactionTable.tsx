import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { UraTransaction } from "@/data/mockData";

const fmt = (n: number) =>
  n.toLocaleString("en-SG", { style: "currency", currency: "SGD", maximumFractionDigits: 0 });

const TransactionTable = ({ data }: { data: UraTransaction[] }) => (
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Source</TableHead>
        <TableHead>Project</TableHead>
        <TableHead>Street</TableHead>
        <TableHead>Type</TableHead>
        <TableHead className="text-right">Area</TableHead>
        <TableHead>Floor</TableHead>
        <TableHead className="text-right">Price</TableHead>
        <TableHead className="text-right">$/psf</TableHead>
        <TableHead>Sale Type</TableHead>
        <TableHead>Date</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {data.map((t, i) => (
        <TableRow key={i}>
          <TableCell>
            <Badge
              variant={t.source === "HDB" ? "secondary" : "default"}
              className={
                t.source === "HDB"
                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                  : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200"
              }
            >
              {t.source || "Private"}
            </Badge>
          </TableCell>
          <TableCell className="font-medium">{t.project}</TableCell>
          <TableCell>{t.street}</TableCell>
          <TableCell>{t.propertyType}</TableCell>
          <TableCell className="text-right">{t.areaSqft} sqft</TableCell>
          <TableCell>{t.floorRange}</TableCell>
          <TableCell className="text-right">{fmt(t.price)}</TableCell>
          <TableCell className="text-right">{fmt(t.pricePsf)}</TableCell>
          <TableCell>{t.typeOfSale}</TableCell>
          <TableCell>{t.contractDate}</TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
);

export default TransactionTable;
